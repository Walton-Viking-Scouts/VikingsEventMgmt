/**
 * Water Rota data service: discovers the yearly rota FlexiRecord across the
 * user's sections, loads and decodes it, and performs the three rota writes
 * (signup, session metadata, plan config).
 *
 * Write discipline (PRD §5.4 freshness constraint): every write re-fetches
 * the live grid, merges into the writer's OWN cell only (preserving whatever
 * else that cell holds), sends a single updateFlexiRecord, then patches the
 * local cache optimistically. Writes are serialized through a module-level
 * promise-chain lock so two in-flight writes cannot interleave their
 * read-merge-write cycles. Rota writes are online-only — offline attempts
 * throw WRITE_UNAVAILABLE from the API layer.
 *
 * @module rotaService
 */

import {
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
  updateFlexiRecord,
} from '../../../shared/services/api/api/index.js';
import databaseService from '../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../shared/services/storage/currentActiveTermsService.js';
import { parseFlexiStructure } from '../../../shared/utils/flexiRecordTransforms.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import {
  ROTA_CONFIG_COLUMN,
  SIGNUP_STATUS,
  encodeConfig,
  encodeSessionMeta,
  encodeSignup,
  mergeLwwConfig,
  mergeSessionColumn,
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
 * @returns {Promise<LoadedRota|null>} Decoded rota, or null when none exists for the year
 * @throws {Error} When the record exists but its structure is invalid or unreadable
 */
export async function loadRota(year, token) {
  const discovery = await discoverRotaRecord(year, token);
  if (!discovery) {
    return null;
  }

  const { hostSection, recordId } = discovery;
  const termId = await resolveRotaTermId(hostSection.sectionid);
  if (!termId) {
    throw new Error('No active term found for the rota host section');
  }

  const structureData = await getFlexiStructure(recordId, hostSection.sectionid, termId, token);
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

  const sessions = check.sessionColumns.map((column) => {
    const { meta, signups } = mergeSessionColumn(
      items.map((item) => ({
        scoutid: item.scoutid,
        name: memberName(item),
        value: item[column.fieldId],
      })),
    );
    return { ...column, meta, signups };
  });

  const members = items.map((item) => ({
    scoutid: String(item.scoutid),
    name: memberName(item),
  }));

  return { year, hostSection, recordId, termId, config, sessions, members };
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

    await updateFlexiRecord(
      hostSection.sectionid,
      scoutid,
      recordId,
      fieldId,
      newValue,
      termId,
      hostSection.section,
      token,
    );

    await patchLocalCache({ recordId, hostSection, termId, scoutid, fieldId, newValue });
  });
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
