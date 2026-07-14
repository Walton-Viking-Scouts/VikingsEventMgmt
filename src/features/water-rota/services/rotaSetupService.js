/**
 * Water Rota setup: creates (or completes) the yearly rota FlexiRecord with
 * one column per planned session, writes the initial plan config, and diffs
 * an existing rota against freshly generated sessions for programme sync.
 *
 * Creation is resumable and idempotent — it reuses the flexi-records
 * create-or-complete orchestrator, which only adds missing columns and
 * returns per-column errors on partial failure. That matters here because
 * OSM has no column delete: an aborted run must be completable, never
 * duplicated.
 *
 * @module rotaSetupService
 */

import { createOrCompleteFlexiRecord } from '../../flexi-records/services/flexiRecordCreationService.js';
import {
  getFlexiStructure,
} from '../../../shared/services/api/api/index.js';
import { CurrentActiveTermsService } from '../../../shared/services/storage/currentActiveTermsService.js';
import { parseFlexiStructure } from '../../../shared/utils/flexiRecordTransforms.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import {
  ROTA_CONFIG_COLUMN,
  buildSessionColumnName,
  parseSessionColumnName,
} from './rotaEncoding.js';
import { ROTA_CREATE_OPTIONS, ROTA_RECORD_NAME_PREFIX } from './rotaTemplates.js';
import { loadRota, prefillRegulars, writeConfig, writeSessionMeta } from './rotaService.js';
import { fetchProgrammeMeetings } from './programmeService.js';
import { generateSessionsFromProgramme } from '../utils/rotaDates.js';

/**
 * Create or complete the rota record for a year on the host section.
 *
 * STOPGAP (pre-WP3): the per-section-record model's `buildRotaRecordName`
 * needs a record identity ({sectionName, seasonBucket, sectionId, termId},
 * PRD §2.1) that this whole-year, multi-section function has no way to
 * supply, so this still names the record with the plain year-based literal
 * rather than the new builder. WP3 replaces this whole function with the
 * per-section create flow (PRD §4.2).
 *
 * @param {Object} params
 * @param {Object} params.hostSection - Host section ({sectionid, sectionname, section})
 * @param {number} params.year - Calendar year the rota covers
 * @param {string|number} params.termId - Term id for structure reads
 * @param {import('../utils/rotaDates.js').SessionDescriptor[]} params.sessions - Sessions to create columns for
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<import('../../flexi-records/services/flexiRecordCreationService.js').CreationResult>} Per-column result; success=false with errors on partial failure (safe to re-run)
 */
export async function createOrCompleteRota({ hostSection, year, termId, sessions, token }) {
  const template = {
    name: `${ROTA_RECORD_NAME_PREFIX} ${year}`,
    fields: [
      ROTA_CONFIG_COLUMN,
      ...sessions.map((session) => buildSessionColumnName(session.date, session.sectionId)),
    ],
    createOptions: ROTA_CREATE_OPTIONS,
  };

  return createOrCompleteFlexiRecord({ section: hostSection, template, termId, token });
}

/**
 * Write the initial (or updated) plan config after the record exists.
 * Reads the structure fresh to resolve the RotaConfig column id, then
 * delegates to the standard LWW config write (a plain replace — a
 * single-section record has nothing to merge).
 *
 * @param {Object} params
 * @param {Object} params.hostSection - Host section
 * @param {string|number} params.recordId - FlexiRecord id from creation
 * @param {string|number} params.termId - Term id
 * @param {string|number} params.scoutid - The editor's member row id in the host section
 * @param {string} params.by - Editor display name
 * @param {Object} params.cfg - This record's plan config
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<void>}
 * @throws {Error} When the RotaConfig column cannot be found
 */
export async function writeRotaConfig({ hostSection, recordId, termId, scoutid, by, cfg, token }) {
  const structureData = await getFlexiStructure(recordId, hostSection.sectionid, termId, token, true);
  const configFieldId = findConfigFieldId(structureData);
  if (!configFieldId) {
    throw new Error('RotaConfig column not found on the rota record');
  }

  await writeConfig({
    rota: { hostSection, recordId, termId },
    configFieldId,
    scoutid,
    by,
    cfg,
    token,
  });
}

/**
 * Diff generated session descriptors against the columns already on the
 * record. Pure. Used both by setup re-entry and "Sync from programme".
 *
 * @param {Array<{fieldId: string, date: string, sectionId: string}>} existingColumns - Session columns from validateWaterRotaStructure
 * @param {import('../utils/rotaDates.js').SessionDescriptor[]} descriptors - Freshly generated sessions
 * @returns {{toAdd: Array, orphaned: Array}} Descriptors needing new columns, and existing columns with no matching descriptor (candidates to mark not-on-water)
 */
export function diffSessions(existingColumns, descriptors) {
  const existingNames = new Set(
    (existingColumns ?? []).map((column) => buildSessionColumnName(column.date, column.sectionId)),
  );
  const descriptorNames = new Set(
    (descriptors ?? []).map((descriptor) => buildSessionColumnName(descriptor.date, descriptor.sectionId)),
  );

  const toAdd = (descriptors ?? []).filter(
    (descriptor) => !existingNames.has(buildSessionColumnName(descriptor.date, descriptor.sectionId)),
  );
  const orphaned = (existingColumns ?? []).filter(
    (column) => !descriptorNames.has(buildSessionColumnName(column.date, column.sectionId)),
  );

  return { toAdd, orphaned };
}

/**
 * Sync an existing rota with its (single) section's programme: appends
 * columns for newly added meeting dates and reports sessions whose programme
 * meeting has vanished (candidates to mark not-on-water — never deleted,
 * since OSM has no column delete).
 *
 * STOPGAP (pre-WP3): still resolves the section's *current active* term via
 * {@link CurrentActiveTermsService} rather than the record's own planning
 * `termId` (PRD §4.4) — LoadedRota doesn't thread a planning termid through
 * this call site yet. `uncheckedSections`/`failedSections` are single-section
 * results (0 or 1 entries), kept as arrays for now to minimize caller churn.
 *
 * @param {Object} params
 * @param {import('./rotaService.js').LoadedRota} params.rota - Loaded rota with config
 * @param {string} params.token - OSM authentication token
 * @param {string|number} [params.scoutid] - Editor's host-section row id, to attribute the title backfill config write
 * @param {string} [params.by] - Editor display name for the title backfill config write
 * @returns {Promise<{added: number, orphaned: Array, errors: Array, titlesUpdated: number, titleWriteFailed: boolean, titlesSkippedNoIdentity: boolean, uncheckedSections: string[], failedSections: string[]}>}
 *   Sync outcome. `uncheckedSections` = no active term found (benign, nothing
 *   to sync); `failedSections` = the programme fetch threw (a real error,
 *   e.g. expired token) — both are excluded from `orphaned`.
 * @throws {Error} When the rota has no config to sync against
 */
export async function syncRotaWithProgramme({ rota, token, scoutid, by }) {
  const cfg = rota?.config?.cfg;
  if (!cfg) {
    throw new Error('The rota has no plan config yet — run setup first');
  }

  const range = { start: cfg.start, end: cfg.end };
  const descriptors = [];
  // Set when the section's programme couldn't be read this run. We must NOT
  // treat its existing sessions as orphaned — we don't know its programme, so
  // leave them untouched. Split by cause so the caller can tell a benign "no
  // active term" apart from a real fetch failure (e.g. an expired token) and
  // message accordingly.
  const unchecked = new Set();
  const failed = new Set();

  try {
    const term = await CurrentActiveTermsService.getCurrentActiveTerm(cfg.sid);
    if (!term?.currentTermId) {
      unchecked.add(String(cfg.sid));
    } else {
      const meetings = await fetchProgrammeMeetings(cfg.sid, term.currentTermId, token);
      descriptors.push(...generateSessionsFromProgramme(meetings, cfg, range));
    }
  } catch (error) {
    failed.add(String(cfg.sid));
    logger.warn('Programme sync: section fetch failed', {
      sectionId: cfg.sid,
      error: error.message,
    }, LOG_CATEGORIES.API);
  }

  if (failed.size > 0) {
    logger.error('Programme sync: could not read one or more sections\' programmes', {
      failedSections: [...failed],
    }, LOG_CATEGORIES.API);
  }

  const existingColumns = rota.sessions.map((session) => ({
    fieldId: session.fieldId,
    date: session.date,
    sectionId: session.sectionId,
  }));
  const { toAdd, orphaned: rawOrphaned } = diffSessions(existingColumns, descriptors);
  // Drop orphans from any section we couldn't check (no term or fetch error) —
  // otherwise a transient failure would flag every one of its valid sessions.
  const orphaned = rawOrphaned.filter(
    (column) => !unchecked.has(String(column.sectionId)) && !failed.has(String(column.sectionId)),
  );

  let errors = [];
  if (toAdd.length > 0) {
    const result = await createOrCompleteRota({
      hostSection: rota.hostSection,
      year: rota.year,
      termId: rota.termId,
      sessions: toAdd,
      token,
    });
    errors = result.errors ?? [];

    // Pre-fill the section's regulars onto the NEW sessions only — never
    // re-touch existing sessions, which would undo people's withdrawals.
    const regularsBySection = { [String(cfg.sid)]: cfg.regulars ?? [] };
    if (Object.values(regularsBySection).some((list) => list.length > 0)) {
      const reloaded = await loadRota(rota.year, token);
      const addedNames = new Set(toAdd.map((d) => buildSessionColumnName(d.date, d.sectionId)));
      const newSessions = (reloaded?.sessions ?? []).filter(
        (session) => session.fieldId && addedNames.has(buildSessionColumnName(session.date, session.sectionId)),
      );
      await prefillRegulars({ rota: reloaded, regularsBySection, token, sessions: newSessions });
    }
  }

  if (errors.length > 0) {
    logger.error('Programme sync: some session columns failed to create', {
      errors,
    }, LOG_CATEGORIES.API);
  }

  // Backfill programme titles onto every session (existing + newly added) so
  // the board shows the real meeting name instead of a guessed water-activity
  // preset. Compute the diff first, independent of identity, so we can tell
  // "nothing to update" apart from "changes pending but no editor to attribute
  // them to" — and preserve each session's existing config state (its
  // not-on-water flag / activity override) by merging rather than replacing.
  // Only descriptors from sections we actually read this run are considered, so
  // a section we couldn't reach never loses its stored title.
  const nextSessions = { ...(cfg.sessions ?? {}) };
  let pendingTitles = 0;
  for (const descriptor of descriptors) {
    if (!descriptor.title) {
      continue;
    }
    const key = buildSessionColumnName(descriptor.date, descriptor.sectionId);
    const existing = nextSessions[key] ?? {};
    if (existing.pt !== descriptor.title) {
      nextSessions[key] = { ...existing, pt: descriptor.title };
      pendingTitles += 1;
    }
  }

  let titlesUpdated = 0;
  let titleWriteFailed = false;
  let titlesSkippedNoIdentity = false;
  if (pendingTitles > 0) {
    if (scoutid && by) {
      try {
        await writeRotaConfig({
          hostSection: rota.hostSection,
          recordId: rota.recordId,
          termId: rota.termId,
          scoutid,
          by,
          cfg: { ...cfg, sessions: nextSessions },
          token,
        });
        titlesUpdated = pendingTitles;
      } catch (error) {
        // The write failed, so no titles were saved. Surface it (error, not a
        // warning) instead of reporting a silent success — otherwise the board
        // tells the leader the rota already matches when it does not.
        titleWriteFailed = true;
        logger.error('Programme sync: title backfill config write failed', {
          error: error.message,
          recordId: rota.recordId,
        }, LOG_CATEGORIES.ERROR);
      }
    } else {
      // Editor identity never resolved (e.g. an admin who isn't a host-section
      // member row): we can't attribute the config write. Flag it rather than
      // fold silently into "already matches" — the board prompts the user.
      titlesSkippedNoIdentity = true;
    }
  }

  return {
    added: toAdd.length - errors.filter((entry) => entry.field !== '_meta').length,
    orphaned,
    errors,
    titlesUpdated,
    titleWriteFailed,
    titlesSkippedNoIdentity,
    uncheckedSections: [...unchecked],
    failedSections: [...failed],
  };
}

/**
 * Put a not-on-water programme week onto the water from the board — without
 * re-running the whole setup wizard. Creates the session's signup column (if
 * it doesn't exist yet) and writes its metadata with the not-on-water flag
 * cleared, so the greyed week becomes a live, signup-able session in place.
 *
 * @param {Object} params
 * @param {import('./rotaService.js').LoadedRota} params.rota - Loaded rota
 * @param {string} params.date - Session date (yyyy-mm-dd)
 * @param {string} params.sectionId - OSM section id
 * @param {{act: string, st: string, en: string, k: number, p: number, n?: string}} params.fields - Session metadata
 * @param {string} params.by - Editor display name
 * @param {string|number} params.scoutid - The editor's own member row id
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<import('./rotaService.js').LoadedRota>} The reloaded rota
 * @throws {Error} When the column can't be created or its field id can't be found
 */
export async function activateWaterSession({ rota, date, sectionId, fields, by, scoutid, token }) {
  const result = await createOrCompleteRota({
    hostSection: rota.hostSection,
    year: rota.year,
    termId: rota.termId,
    sessions: [{ date, sectionId }],
    token,
  });
  if (!result.success) {
    throw new Error(result.errors?.[0]?.error || 'Could not create the session');
  }

  // The column was just added, so bypass the cached structure — otherwise the
  // new session comes back as config-only (fieldId null) and the meta write
  // that puts it on the water is silently skipped.
  const reloaded = await loadRota(rota.year, token, { forceRefresh: true });
  const columnName = buildSessionColumnName(date, sectionId);
  const session = (reloaded?.sessions ?? []).find(
    (s) => s.fieldId && buildSessionColumnName(s.date, s.sectionId) === columnName,
  );
  if (!session) {
    throw new Error('Session was created but could not be confirmed — reopen it and try again');
  }

  // meta.c:0 wins over the config's not-on-water override, so the week goes
  // on the water without rewriting the whole plan config.
  await writeSessionMeta({
    rota: reloaded,
    fieldId: session.fieldId,
    scoutid,
    by,
    fields: { ...fields, c: 0 },
    token,
  });

  return reloaded;
}

/**
 * Resolve the RotaConfig column id from a raw structure response.
 *
 * @param {Object|null} structureData - Raw getFlexiStructure response
 * @returns {string|null} Field id (f_N), or null when absent
 */
function findConfigFieldId(structureData) {
  if (!structureData) {
    return null;
  }
  const mapping = parseFlexiStructure(structureData);
  for (const [fieldId, fieldInfo] of mapping.entries()) {
    if (fieldInfo?.name === ROTA_CONFIG_COLUMN) {
      return fieldId;
    }
  }
  return null;
}

export { parseSessionColumnName };
