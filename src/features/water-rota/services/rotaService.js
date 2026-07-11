/**
 * Water Rota data service: discovers the yearly rota FlexiRecord across the
 * user's sections, loads and decodes it, and performs the rota writes
 * (signup, session metadata, plan config, and regular pre-fill).
 *
 * Write discipline (PRD §5.4 freshness constraint): the per-user writes
 * (signup, session metadata) re-fetch the live grid, merge into a single
 * target row's cell (the caller's own row for signup/meta; a deterministic
 * anchor row for config — see writeConfig), send one updateFlexiRecord, then
 * patch the local cache optimistically. These are serialized through a
 * module-level promise-chain lock so two in-flight writes cannot interleave
 * their read-merge-write cycles. prefillRegulars is a setup-time bulk write
 * that targets other members' rows (organiser-only, cells empty). Rota writes
 * are online-only — offline attempts throw WRITE_UNAVAILABLE from the API
 * layer.
 *
 * @module rotaService
 */

import {
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
  updateFlexiRecord,
  multiUpdateFlexiRecord,
} from '../../../shared/services/api/api/index.js';
import databaseService from '../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../shared/services/storage/currentActiveTermsService.js';
import { parseFlexiStructure } from '../../../shared/utils/flexiRecordTransforms.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import {
  ROTA_CONFIG_COLUMN,
  SIGNUP_STATUS,
  buildSessionColumnName,
  encodeConfig,
  encodeSessionMeta,
  encodeSignup,
  mergeLwwConfig,
  mergeSessionColumn,
  parseSessionColumnName,
} from './rotaEncoding.js';
import { buildRotaRecordName } from './rotaTemplates.js';
import { validateWaterRotaStructure } from './vikingWaterRotaValidation.js';

let writeLock = Promise.resolve();

/**
 * Serialize rota writes so concurrent read-merge-write cycles cannot
 * interleave (same pattern as signInOutbox's withStoreLock).
 *
 * @param {Function} fn - Async operation to run under the lock
 * @returns {Promise<*>} The operation's result
 */
function withWriteLock(fn) {
  const run = writeLock.then(fn);
  writeLock = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * A loaded, decoded rota.
 *
 * @typedef {Object} LoadedRota
 * @property {number} year - Rota calendar year
 * @property {Object} hostSection - Section the record lives in ({sectionid, sectionname, section, ...})
 * @property {string|number} recordId - FlexiRecord id (extraid)
 * @property {string} termId - Term id used for grid reads
 * @property {Object|null} config - LWW-winning plan config candidate ({v, at, by, cfg}), null before first config write
 * @property {Array<Object>} sessions - Decoded sessions ({fieldId, date, sectionId, meta, signups})
 * @property {Array<{scoutid: string, name: string}>} members - Host-section member rows
 */

/**
 * Find the rota FlexiRecord for a year by scanning the user's sections.
 *
 * @param {number} year - Calendar year
 * @param {string} token - OSM authentication token
 * @returns {Promise<{hostSection: Object, recordId: string|number}|null>} Discovery result, or null when no rota exists
 */
export async function discoverRotaRecord(year, token) {
  const recordName = buildRotaRecordName(year);
  const sections = (await databaseService.getSections()) || [];

  for (const section of sections) {
    try {
      const list = await getFlexiRecords(section.sectionid, token);
      const match = (list?.items || []).find((record) => record.name === recordName);
      if (match) {
        return { hostSection: section, recordId: match.extraid };
      }
    } catch (error) {
      logger.warn('Rota discovery: flexi list read failed for section', {
        sectionId: section.sectionid,
        error: error.message,
      }, LOG_CATEGORIES.API);
    }
  }

  return null;
}

/**
 * Resolve the term id to use for rota grid reads on the host section.
 *
 * @param {string|number} hostSectionId - Host section id
 * @returns {Promise<string|null>} Current active term id, or null when unknown
 */
export async function resolveRotaTermId(hostSectionId) {
  try {
    const term = await CurrentActiveTermsService.getCurrentActiveTerm(hostSectionId);
    return term?.currentTermId ?? null;
  } catch (error) {
    logger.warn('Rota: current active term lookup failed', {
      hostSectionId,
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    return null;
  }
}

/**
 * Load and decode the rota for a year: discovery, structure validation,
 * LWW config merge, and per-session column merges. Persists the fetched
 * grid to the flexi cache so the board renders offline afterwards.
 *
 * @param {number} year - Calendar year
 * @param {string} token - OSM authentication token
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass the structure cache (use after adding a column)
 * @returns {Promise<LoadedRota|null>} Decoded rota, or null when none exists for the year
 * @throws {Error} When the record exists but its structure is invalid or unreadable
 */
export async function loadRota(year, token, { forceRefresh = false } = {}) {
  const discovery = await discoverRotaRecord(year, token);
  if (!discovery) {
    return null;
  }

  const { hostSection, recordId } = discovery;
  const termId = await resolveRotaTermId(hostSection.sectionid);
  if (!termId) {
    throw new Error('No active term found for the rota host section');
  }

  const structureData = await getFlexiStructure(recordId, hostSection.sectionid, termId, token, forceRefresh);
  const structure = decodeStructure(structureData);
  const check = validateWaterRotaStructure(structure);
  if (!check.isValid) {
    throw new Error(`Water rota record is invalid: ${check.errors.join('; ')}`);
  }

  const grid = await getSingleFlexiRecord(recordId, hostSection.sectionid, termId, token);
  const items = Array.isArray(grid?.items) ? grid.items : [];

  try {
    await databaseService.saveFlexiData(recordId, hostSection.sectionid, termId, items);
  } catch (error) {
    logger.warn('Rota: caching grid for offline use failed', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
  }

  const config = mergeLwwConfig(items.map((item) => item[check.configFieldId]));

  const photoMap = await loadMemberPhotoMap(hostSection.sectionid);

  const sessions = check.sessionColumns.map((column) => {
    const { meta, signups } = mergeSessionColumn(
      items.map((item) => ({
        scoutid: item.scoutid,
        name: memberName(item),
        value: item[column.fieldId],
      })),
    );
    return { ...column, meta, signups: signups.map((person) => ({ ...person, photo_guid: photoMap.get(String(person.scoutid)) ?? null })) };
  });

  // Not-on-water programme weeks live in the config only (no signup column).
  // Surface them as display-only sessions so the full term shows on the board.
  const columnNames = new Set(
    check.sessionColumns.map((column) => buildSessionColumnName(column.date, column.sectionId)),
  );
  for (const columnName of Object.keys(config?.cfg?.sessions ?? {})) {
    if (columnNames.has(columnName)) {
      continue;
    }
    const parsed = parseSessionColumnName(columnName);
    if (parsed) {
      sessions.push({ fieldId: null, date: parsed.date, sectionId: parsed.sectionId, meta: null, signups: [] });
    }
  }

  const members = items.map((item) => ({
    scoutid: String(item.scoutid),
    name: memberName(item),
    photo_guid: photoMap.get(String(item.scoutid)) ?? null,
  }));

  const sectionNames = await loadSectionNameMap();

  return {
    year,
    hostSection,
    recordId,
    termId,
    configFieldId: check.configFieldId,
    config,
    sessions,
    members,
    sectionNames,
  };
}

/**
 * Build a sectionId → display name map from cached sections, so sessions can
 * show a real section name even when the plan config is missing or does not
 * cover a section.
 *
 * @returns {Promise<Object>} Map of string section id to section name
 */
async function loadSectionNameMap() {
  try {
    const sections = (await databaseService.getSections()) || [];
    return Object.fromEntries(
      sections.map((section) => [String(section.sectionid), section.sectionname]),
    );
  } catch (error) {
    logger.warn('Rota: section name map load failed', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    return {};
  }
}

/**
 * Build a scoutid → photo_guid map for the host section's members from the
 * cached member store, so signup avatars can render real OSM photos. Photos
 * are cosmetic, so any failure degrades silently to an empty map (initials).
 *
 * @param {string|number} hostSectionId - Host section id (FlexiRecord rows live here)
 * @returns {Promise<Map<string, string|null>>} scoutid (string) → photo_guid
 */
async function loadMemberPhotoMap(hostSectionId) {
  try {
    const members = (await databaseService.getMembers([Number(hostSectionId)])) || [];
    return new Map(members.map((member) => [String(member.scoutid), member.photo_guid ?? null]));
  } catch (error) {
    logger.warn('Rota: member photo map load failed', { error: error.message }, LOG_CATEGORIES.ERROR);
    return new Map();
  }
}

/**
 * Write the caller's signup for one session into their own row.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota (host section, record, term)
 * @param {string} params.fieldId - Session column field id (f_N)
 * @param {string|number} params.scoutid - The caller's member row id in the host section
 * @param {string|null} params.status - SIGNUP_STATUS.IN, SIGNUP_STATUS.BACKUP, or null to withdraw
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function writeSignup({ rota, fieldId, scoutid, status, token }) {
  if (status !== null && !Object.values(SIGNUP_STATUS).includes(status)) {
    throw new Error(`Invalid signup status: ${status}`);
  }
  await writeOwnCell({
    rota,
    fieldId,
    scoutid,
    token,
    mutate: (ownRaw) => encodeSignup(ownRaw, status, new Date().toISOString()),
  });
}

/**
 * Assign another member's signup for a session (leader action). Same locked,
 * read-merged own-cell write as writeSignup — writeOwnCell targets whatever
 * scoutid it is given and encodeSignup preserves that member's existing cell
 * metadata — just named for the "a leader adds a permit holder they know is
 * coming" flow. The scoutid must be a member row in the host section.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.fieldId - Session column field id (f_N)
 * @param {string|number} params.scoutid - The assigned member's host-section row id
 * @param {string|null} params.status - SIGNUP_STATUS.IN, SIGNUP_STATUS.BACKUP, or null to remove
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function assignSignup({ rota, fieldId, scoutid, status, token }) {
  return writeSignup({ rota, fieldId, scoutid, status, token });
}

/**
 * Write a session-metadata update into the editor's own row, bumping the
 * LWW version above the current column winner read live inside the lock.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.fieldId - Session column field id (f_N)
 * @param {string|number} params.scoutid - The editor's member row id
 * @param {string} params.by - Editor display name for the audit trail
 * @param {{act: string, st: string, en: string, k: number, p: number, n?: string, c: 0|1}} params.fields - Full metadata fields
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function writeSessionMeta({ rota, fieldId, scoutid, by, fields, token }) {
  await writeOwnCell({
    rota,
    fieldId,
    scoutid,
    token,
    mutate: (ownRaw, items) => {
      const { meta: winner } = mergeSessionColumn(
        items.map((item) => ({ scoutid: item.scoutid, name: '', value: item[fieldId] })),
      );
      const meta = {
        ...fields,
        v: (winner?.v ?? 0) + 1,
        at: new Date().toISOString(),
        by,
      };
      return encodeSessionMeta(ownRaw, meta);
    },
  });
}

/**
 * Write a whole-plan config candidate into the editor's own RotaConfig cell,
 * bumping the LWW version above the current winner read live inside the lock.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.configFieldId - RotaConfig column field id (f_N)
 * @param {string|number} params.scoutid - The editor's member row id
 * @param {string} params.by - Editor display name
 * @param {Object} params.cfg - Full plan config ({start, end, termId?, sections})
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function writeConfig({ rota, configFieldId, scoutid, by, cfg, token }) {
  await writeOwnCell({
    rota,
    fieldId: configFieldId,
    scoutid,
    token,
    mutate: (_ownRaw, items) => {
      const winner = mergeLwwConfig(items.map((item) => item[configFieldId]));
      return encodeConfig({
        v: (winner?.v ?? 0) + 1,
        at: new Date().toISOString(),
        by,
        cfg,
      });
    },
  });
}

/**
 * Pre-fill a section's regular permit holders as confirmed signups on its
 * water sessions. Setup-time bulk write: one multiUpdateFlexiRecord per
 * session sets every regular's cell to a confirmed signup. Targets other
 * members' rows (organiser-only, run when cells are empty), so it does NOT go
 * through the own-cell write lock. Confirmed-by-default: gaps on a session
 * then represent the extra permit holders still needed.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota (host section, record, term)
 * @param {Object<string, string[]>} params.regularsBySection - Map of sectionId → regular scoutids
 * @param {string} params.token - OSM authentication token
 * @param {Array<{fieldId: string|null, sectionId: string}>} [params.sessions] - Sessions to fill; defaults to every column-backed session in the rota
 * @returns {Promise<{filled: number, errors: Array<{fieldId: string, error: string}>}>} Outcome
 */
export async function prefillRegulars({ rota, regularsBySection, token, sessions }) {
  const targetSessions = (sessions ?? rota.sessions ?? []).filter((session) => session.fieldId);
  const atISO = new Date().toISOString();
  const inValue = JSON.stringify({ s: SIGNUP_STATUS.IN, sat: atISO });

  let filled = 0;
  const errors = [];

  for (const session of targetSessions) {
    const scouts = regularsBySection[String(session.sectionId)] ?? [];
    if (scouts.length === 0) {
      continue;
    }
    try {
      const response = await multiUpdateFlexiRecord(
        rota.hostSection.sectionid,
        scouts,
        inValue,
        session.fieldId,
        rota.recordId,
        token,
      );
      const failure = detectWriteFailure(response);
      if (failure) {
        errors.push({ fieldId: session.fieldId, error: failure });
      } else {
        filled += 1;
      }
    } catch (error) {
      logger.error('Rota: regular pre-fill failed for a session', {
        fieldId: session.fieldId,
        error: error.message,
      }, LOG_CATEGORIES.API);
      errors.push({ fieldId: session.fieldId, error: error.message });
    }
  }

  return { filled, errors };
}

/**
 * Shared write cycle: under the write lock, re-fetch the live grid, compute
 * the caller's new own-cell value, send one updateFlexiRecord, then patch
 * the local flexi cache so the UI reflects the write immediately.
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.fieldId - Column field id being written
 * @param {string|number} params.scoutid - The caller's member row id
 * @param {string} params.token - OSM authentication token
 * @param {(ownRaw: string|undefined, items: Array<Object>) => string} params.mutate - Computes the new cell value from the fresh grid
 * @returns {Promise<void>}
 */
async function writeOwnCell({ rota, fieldId, scoutid, token, mutate }) {
  const { hostSection, recordId, termId } = rota;

  await withWriteLock(async () => {
    const fresh = await getSingleFlexiRecord(recordId, hostSection.sectionid, termId, token);
    const items = Array.isArray(fresh?.items) ? fresh.items : [];
    const ownRow = items.find((item) => String(item.scoutid) === String(scoutid));
    if (!ownRow) {
      throw new Error('Your member row was not found in the rota host section');
    }

    const newValue = mutate(ownRow[fieldId], items);

    const response = await updateFlexiRecord(
      hostSection.sectionid,
      scoutid,
      recordId,
      fieldId,
      newValue,
      termId,
      hostSection.section,
      token,
    );
    const failure = detectWriteFailure(response);
    if (failure) {
      throw new Error(`OSM rejected the write: ${failure}`);
    }

    await patchLocalCache({ recordId, hostSection, termId, scoutid, fieldId, newValue });
  });
}

/**
 * Detect an OSM write rejection returned as HTTP 200 with a failure body.
 * osmRequest only throws on non-2xx, but OSM write endpoints can return 200
 * with `{error}` / `{ok:false}` / `{success:false}` / `{status:'fail'}`.
 * Conservative on purpose: it does NOT treat `result:0` as failure, because a
 * successful no-op update can legitimately report zero rows changed.
 *
 * @param {*} response - Raw updateFlexiRecord/multiUpdateFlexiRecord response
 * @returns {string|null} A failure message, or null when the response looks fine
 */
function detectWriteFailure(response) {
  if (!response || typeof response !== 'object') {
    return null;
  }
  if (response.error) {
    return String(response.error);
  }
  if (response.success === false) {
    return String(response.message || response.error_description || 'success: false');
  }
  if (response.ok === false) {
    return String(response.message || 'ok: false');
  }
  if (response.status === 'fail' || response.status === 'error') {
    return String(response.message || response.error_description || `status: ${response.status}`);
  }
  return null;
}

/**
 * Optimistically patch one cell in the locally cached grid (same pattern as
 * signInOutbox.applyLocal). Failures are logged, never thrown — the write
 * itself already succeeded.
 *
 * @param {Object} params
 * @param {string|number} params.recordId - FlexiRecord id
 * @param {Object} params.hostSection - Host section
 * @param {string} params.termId - Term id
 * @param {string|number} params.scoutid - Member row id
 * @param {string} params.fieldId - Column field id
 * @param {string} params.newValue - New raw cell value
 * @returns {Promise<void>}
 */
async function patchLocalCache({ recordId, hostSection, termId, scoutid, fieldId, newValue }) {
  try {
    const cached = await databaseService.getFlexiData(recordId, hostSection.sectionid, termId);
    const items = Array.isArray(cached?.items) ? [...cached.items] : [];
    const idx = items.findIndex((item) => String(item.scoutid) === String(scoutid));
    if (idx >= 0) {
      items[idx] = { ...items[idx], [fieldId]: newValue };
    } else {
      items.push({ scoutid, [fieldId]: newValue });
    }
    await databaseService.saveFlexiData(recordId, hostSection.sectionid, termId, items);
  } catch (error) {
    logger.error('Rota: optimistic cache patch failed', {
      error: error.message,
      fieldId,
    }, LOG_CATEGORIES.ERROR);
  }
}

/**
 * Normalize a raw structure response into the {fieldMapping} shape the
 * validator consumes, reusing the shared flexi structure parser.
 *
 * @param {Object|null} structureData - Raw getFlexiStructure response
 * @returns {{fieldMapping: Object}|null} Normalized structure, or null
 */
function decodeStructure(structureData) {
  if (!structureData) {
    return null;
  }
  const mapping = parseFlexiStructure(structureData);
  const fieldMapping = {};
  mapping.forEach((fieldInfo, fieldId) => {
    fieldMapping[fieldId] = fieldInfo;
  });
  return { fieldMapping };
}

/**
 * Display name for a grid row member.
 *
 * @param {Object} item - Grid row item
 * @returns {string} "First Last" (best effort)
 */
function memberName(item) {
  return [item.firstname, item.lastname].filter(Boolean).join(' ').trim();
}

export { ROTA_CONFIG_COLUMN };
