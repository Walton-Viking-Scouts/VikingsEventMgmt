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
import { parseFlexiStructure } from '../../../shared/utils/flexiRecordTransforms.js';
import {
  ROTA_CONFIG_COLUMN,
  buildSessionColumnName,
  parseSessionColumnName,
} from './rotaEncoding.js';
import { ROTA_CREATE_OPTIONS, buildRotaRecordName } from './rotaTemplates.js';
import { writeConfig } from './rotaService.js';

/**
 * Create or complete the rota record for a year on the host section.
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
    name: buildRotaRecordName(year),
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
 * delegates to the standard LWW config write.
 *
 * @param {Object} params
 * @param {Object} params.hostSection - Host section
 * @param {string|number} params.recordId - FlexiRecord id from creation
 * @param {string|number} params.termId - Term id
 * @param {string|number} params.scoutid - The editor's member row id in the host section
 * @param {string} params.by - Editor display name
 * @param {Object} params.cfg - Full plan config ({start, end, termId?, sections})
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
