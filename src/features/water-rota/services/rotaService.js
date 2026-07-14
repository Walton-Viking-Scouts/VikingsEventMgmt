/**
 * Water Rota data service: discovers the per-(planning section, planning
 * term) rota FlexiRecords hosted in the Adults section, loads and decodes
 * them (individually or aggregated into a season-bucket group), and performs
 * the rota writes (signup, session metadata, plan config, and regular
 * pre-fill).
 *
 * Write discipline (PRD §5.4 freshness constraint): the per-user writes
 * (signup, session metadata) re-fetch the live grid, merge into a single
 * target row's cell (the caller's own row for signup/meta; a deterministic
 * anchor row for config — see writeConfig), send one updateFlexiRecord, then
 * patch the local cache optimistically. These are serialized through a
 * module-level promise-chain lock so two in-flight writes cannot interleave
 * their read-merge-write cycles. prefillRegulars is a setup-time bulk write
 * that targets other members' rows (organiser-only, cells empty), throttled
 * between calls to stay under OSM's rate limit. Rota writes are online-only —
 * offline attempts throw WRITE_UNAVAILABLE from the API layer.
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
import { parseRotaRecordName } from './rotaTemplates.js';
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
 * A rota record's discovered identity, parsed from its FlexiRecord name
 * (PRD §2.1) plus where it lives.
 *
 * @typedef {Object} RotaDescriptor
 * @property {string} sectionName - Planning section's display name
 * @property {string} seasonBucket - Deterministic season label, e.g. "Summer 2026"
 * @property {string} sectionId - Planning section id
 * @property {string} termId - Planning section's own term id the plan was built from
 * @property {string|number} recordId - FlexiRecord id (extraid)
 * @property {Object} hostSection - The Adults section the record is hosted in
 */

/**
 * A loaded, decoded rota record for one planning section.
 *
 * @typedef {Object} LoadedRota
 * @property {string|number} recordId - FlexiRecord id (extraid)
 * @property {Object} hostSection - Section the record lives in ({sectionid, sectionname, section, ...})
 * @property {string} termId - Host section's read-context term id, resolved at load time (PRD §3.3)
 * @property {string} sectionId - Planning section id (from the record's identity)
 * @property {string} planningTermId - Planning section's own term id (from the record's identity)
 * @property {string} seasonBucket - Deterministic season label (from the record's identity)
 * @property {string} configFieldId - RotaConfig column field id (f_N)
 * @property {Object|null} config - LWW-winning plan config candidate ({v, at, by, cfg}), null before first config write
 * @property {Array<Object>} sessions - Decoded sessions ({fieldId, date, sectionId, meta, signups})
 * @property {Array<{scoutid: string, name: string, photo_guid: string|null}>} members - Host-section member rows
 * @property {Object} sectionNames - Map of section id to display name
 */

/**
 * A season bucket's aggregated view across every planning section's record.
 *
 * @typedef {Object} RotaGroup
 * @property {string} seasonBucket - The bucket loaded, e.g. "Summer 2026"
 * @property {Object|null} hostSection - Shared Adults section (from any record)
 * @property {LoadedRota[]} records - Every loaded record in the bucket
 * @property {Object|null} config - Assembled group config (see {@link assembleGroupConfig})
 * @property {Array<Object>} sessions - Union of every record's sessions, each with a `record` back-reference
 * @property {Array<Object>} members - Adults roster (same rows in every record — taken from the first)
 * @property {Object} sectionNames - Map of section id to display name (from the first record)
 */

/**
 * Find the Adults section that hosts every rota record, by name — the same
 * heuristic the setup wizard already uses as a default (PRD §3.1).
 *
 * @param {Array<Object>} sections - Cached sections ({sectionid, sectionname, section, ...})
 * @returns {Object|null} The host section, or null when none looks like Adults
 */
export function findHostSection(sections) {
  return (sections ?? []).find((s) =>
    `${s.section ?? ''} ${s.sectionname ?? ''}`.toLowerCase().includes('adult')) ?? null;
}

/**
 * Discover every rota record via a single flexi-list read on the Adults host
 * section (falling back to scanning every cached section when no Adults
 * section is visible). Record identity is parsed entirely from each item's
 * name (PRD §2.1) — no term resolution is involved in discovery.
 *
 * @param {string} token - OSM authentication token
 * @param {number} [priority=0] - Rate-limit queue priority for the flexi-list read(s)
 * @returns {Promise<RotaDescriptor[]>} Every discovered rota record, deduped by (sectionId, termId)
 */
export async function discoverRotaRecords(token, priority = 0) {
  const sections = (await databaseService.getSections()) || [];
  const hostSection = findHostSection(sections);
  const scan = hostSection ? [hostSection] : sections;
  const byIdentity = new Map();

  for (const section of scan) {
    let list;
    try {
      list = await getFlexiRecords(section.sectionid, token, 'n', false, priority);
    } catch (error) {
      logger.warn('Rota: flexi-list read failed for a section during discovery', {
        sectionId: section.sectionid,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      if (hostSection) {
        // Host-only scan: a failed read here means we genuinely don't know
        // whether rota records exist — surface the error instead of
        // silently reporting "no rota", which would invite a duplicate setup.
        throw error;
      }
      continue;
    }
    for (const item of list?.items || []) {
      const parsed = parseRotaRecordName(item.name);
      if (!parsed) {
        continue;
      }
      const key = `${parsed.sectionId}.${parsed.termId}`;
      const existing = byIdentity.get(key);
      // Numeric lowest-extraid dedupe for accidental same-name duplicates
      // (extraids "9" vs "10" must pick "9" — a string compare would not).
      if (!existing || Number(item.extraid) < Number(existing.recordId)) {
        byIdentity.set(key, { ...parsed, recordId: item.extraid, hostSection: section });
      }
    }
  }

  return [...byIdentity.values()];
}

/**
 * Resolve the host section's current-active-term id for rota grid reads,
 * fresh on every load (PRD §3.3). Record identity never depends on this
 * value — only the API/cache reads within a load do.
 *
 * @param {string|number} hostSectionId - Host section id
 * @returns {Promise<string|null>} Current active term id, or null when unknown
 */
async function resolveHostReadTermId(hostSectionId) {
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
 * Load and decode one rota record: structure validation, LWW config merge,
 * and per-session column merges. Persists the fetched grid to the flexi
 * cache so the board renders offline afterwards.
 *
 * @param {RotaDescriptor} descriptor - Record identity from {@link discoverRotaRecords}
 * @param {string} token - OSM authentication token
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass the structure cache (use after adding a column)
 * @param {number} [options.priority=0] - Rate-limit queue priority for this load's reads; raise
 *   on a deep-link/landing load so the rota jumps ahead of the background post-login sync
 * @returns {Promise<LoadedRota>} Decoded rota record
 * @throws {Error} When the host section has no cached current active term, or the record's structure is invalid or unreadable
 */
export async function loadRota(descriptor, token, { forceRefresh = false, priority = 0 } = {}) {
  const { recordId, hostSection } = descriptor;
  const hostTermId = await resolveHostReadTermId(hostSection.sectionid);
  if (!hostTermId) {
    throw new Error('No active term found for the rota host section');
  }

  const structureData = await getFlexiStructure(recordId, hostSection.sectionid, hostTermId, token, forceRefresh, priority);
  const structure = decodeStructure(structureData);
  const check = validateWaterRotaStructure(structure);
  if (!check.isValid) {
    throw new Error(`Water rota record is invalid: ${check.errors.join('; ')}`);
  }

  const grid = await getSingleFlexiRecord(recordId, hostSection.sectionid, hostTermId, token, priority);
  const items = Array.isArray(grid?.items) ? grid.items : [];

  try {
    await databaseService.saveFlexiData(recordId, hostSection.sectionid, hostTermId, items);
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
    recordId,
    hostSection,
    termId: hostTermId,
    sectionId: descriptor.sectionId,
    planningTermId: descriptor.termId,
    seasonBucket: descriptor.seasonBucket,
    configFieldId: check.configFieldId,
    config,
    sessions,
    members,
    sectionNames,
  };
}

/**
 * Assemble the board's group-wide config shape from every loaded record's
 * single-section config (PRD §2.5) — sections[] plus a merged sessions{} map
 * (session column names never collide across records, since the sectionid
 * stays in the key) and the union of every record's date range.
 *
 * @param {LoadedRota[]} records - Loaded records (each `.config` may be null)
 * @returns {{cfg: {start: string|undefined, end: string|undefined, sections: Array, sessions: Object}}|null}
 *   Assembled config, or null when no record has config yet
 */
export function assembleGroupConfig(records) {
  const sections = [];
  const sessions = {};
  let start, end;
  for (const record of records) {
    const c = record.config?.cfg;
    if (!c) continue;
    sections.push({ sid: c.sid, sname: c.sname, act: c.act, st: c.st, en: c.en,
      k: c.k, p: c.p, regulars: c.regulars ?? [] });
    Object.assign(sessions, c.sessions ?? {});
    start = !start || (c.start && c.start < start) ? (c.start ?? start) : start;
    end = !end || (c.end && c.end > end) ? (c.end ?? end) : end;
  }
  return sections.length ? { cfg: { start, end, sections, sessions } } : null;
}

/**
 * Assemble a season bucket's aggregated group view from its loaded records.
 * Every session carries a `record` back-reference so writes route to the
 * record that owns it (PRD §5.2–5.3).
 *
 * @param {string} seasonBucket - The bucket assembled, e.g. "Summer 2026"
 * @param {LoadedRota[]} records - Loaded records in the bucket
 * @returns {RotaGroup} Assembled group
 */
export function assembleRotaGroup(seasonBucket, records) {
  return {
    seasonBucket,
    hostSection: records[0]?.hostSection ?? null,
    records,
    config: assembleGroupConfig(records),
    sessions: records.flatMap((record) => record.sessions.map((session) => ({ ...session, record }))),
    members: records[0]?.members ?? [],
    sectionNames: records[0]?.sectionNames ?? {},
  };
}

/**
 * Discover and load every rota record in a season bucket, aggregated into
 * the board's group view.
 *
 * @param {string} seasonBucket - Season bucket to load, e.g. "Summer 2026"
 * @param {string} token - OSM authentication token
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass the structure cache on every record load
 * @param {number} [options.priority=0] - Rate-limit queue priority for every read in this load
 * @returns {Promise<RotaGroup|null>} Assembled group, or null when the bucket has no records
 */
export async function loadRotaGroup(seasonBucket, token, { forceRefresh = false, priority = 0 } = {}) {
  const descriptors = (await discoverRotaRecords(token, priority))
    .filter((d) => !seasonBucket || d.seasonBucket === seasonBucket);
  if (descriptors.length === 0) {
    return null;
  }
  const records = await Promise.all(descriptors.map((d) => loadRota(d, token, { forceRefresh, priority })));
  return assembleRotaGroup(seasonBucket, records.filter(Boolean));
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
 * Base metadata used as the merge target when a session has no prior
 * metadata candidate at all (a brand-new column) — matches the defaults
 * SessionEditForm/SessionDetailModal show for an unedited session.
 * @type {{act: string, st: string, en: string, k: number, p: number, c: 0}}
 */
const SESSION_META_DEFAULTS = { act: 'On the water', st: '18:30', en: '20:00', k: 0, p: 0, c: 0 };

/**
 * Write a session-metadata patch into the editor's own row, merging it onto
 * the live column winner read fresh inside the lock (falling back to
 * {@link SESSION_META_DEFAULTS} when no winner exists yet) and bumping the
 * LWW version above it. Only the fields present in `metaPatch` are changed —
 * a concurrent co-leader's edit to any field the caller didn't touch
 * survives (PRD §5.4 freshness constraint).
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.fieldId - Session column field id (f_N)
 * @param {string|number} params.scoutid - The editor's member row id
 * @param {string} params.by - Editor display name for the audit trail
 * @param {{act?: string, st?: string, en?: string, k?: number, p?: number, n?: string, c?: 0|1}} params.metaPatch - Only the fields the caller intends to change
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function writeSessionMeta({ rota, fieldId, scoutid, by, metaPatch, token }) {
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
        ...(winner ?? SESSION_META_DEFAULTS),
        ...metaPatch,
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
 * bumping the LWW version above the current winner read live inside the
 * lock.
 *
 * Two modes: `replace: true` is an intentional full-plan replace (the setup
 * wizard re-running with a fresh plan); the default patch mode shallow-merges
 * `cfg`'s keys onto the live winner's cfg, with `sessions` merged key-wise
 * (winner.cfg.sessions ⊕ cfg.sessions) so a concurrent edit to a field or
 * session override the caller didn't touch survives (PRD §5.4).
 *
 * @param {Object} params
 * @param {LoadedRota} params.rota - Loaded rota
 * @param {string} params.configFieldId - RotaConfig column field id (f_N)
 * @param {string|number} params.scoutid - The editor's member row id
 * @param {string} params.by - Editor display name
 * @param {Object} params.cfg - The full plan config (`replace: true`) or just the changed keys (patch mode)
 * @param {boolean} [params.replace=false] - Full replace instead of a merge patch
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 */
export async function writeConfig({ rota, configFieldId, scoutid, by, cfg, replace = false, token }) {
  await writeOwnCell({
    rota,
    fieldId: configFieldId,
    scoutid,
    token,
    mutate: (_ownRaw, items) => {
      const winner = mergeLwwConfig(items.map((item) => item[configFieldId]));
      const nextCfg = replace ? cfg : mergeConfigPatch(winner?.cfg, cfg);
      return encodeConfig({
        v: (winner?.v ?? 0) + 1,
        at: new Date().toISOString(),
        by,
        cfg: nextCfg,
      });
    },
  });
}

/**
 * Shallow-merge a config patch onto the live winner's cfg, merging `sessions`
 * key-wise rather than replacing the whole map.
 *
 * @param {Object|undefined} winnerCfg - The live LWW winner's cfg (undefined when none)
 * @param {Object} patch - The caller's changed keys
 * @returns {Object} Merged cfg
 */
function mergeConfigPatch(winnerCfg, patch) {
  const merged = { ...(winnerCfg ?? {}), ...patch };
  if (patch.sessions || winnerCfg?.sessions) {
    merged.sessions = { ...(winnerCfg?.sessions ?? {}), ...(patch.sessions ?? {}) };
  }
  return merged;
}

/**
 * Fixed delay between successive prefillRegulars multi-update calls, on top
 * of the underlying rate-limit queue — cheap insurance against a burst of
 * back-to-back writes during setup (PRD §4.3).
 * @type {number}
 */
const PREFILL_THROTTLE_MS = 300;

/**
 * Pre-fill a section's regular permit holders as confirmed signups on its
 * water sessions. Setup-time bulk write: one multiUpdateFlexiRecord per
 * session (throttled between calls) sets every regular's cell to a confirmed
 * signup. Targets other members' rows (organiser-only, run when cells are
 * empty), so it does NOT go through the own-cell write lock. Confirmed-by-
 * default: gaps on a session then represent the extra permit holders still
 * needed.
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
  let calls = 0;

  for (const session of targetSessions) {
    const scouts = regularsBySection[String(session.sectionId)] ?? [];
    if (scouts.length === 0) {
      continue;
    }
    if (calls > 0) {
      await new Promise((resolve) => setTimeout(resolve, PREFILL_THROTTLE_MS));
    }
    calls += 1;
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
