/**
 * Structure validation for a "Viking Water Rota <SectionName> <SeasonBucket>
 * [<sectionid>.<termid>]" FlexiRecord (one per planning section's own term,
 * hosted in the Adults section).
 *
 * Pure sibling of vikingEventMgmtValidation: it takes an already-fetched
 * structure (fieldMapping) rather than fetching, because rota discovery and
 * loading are owned by rotaService. Unknown columns are ignored — aborted
 * setups can leave stray columns and columns can never be deleted in OSM.
 *
 * @module vikingWaterRotaValidation
 */

import { ROTA_CONFIG_COLUMN, parseSessionColumnName } from './rotaEncoding.js';

/**
 * Validate a rota FlexiRecord structure.
 *
 * @param {Object|null} structure - FlexiRecord structure with a fieldMapping of {fieldId: {name, type}}
 * @returns {{isValid: boolean, hasConfigColumn: boolean, sessionColumns: Array<{fieldId: string, date: string, sectionId: string}>, configFieldId: string|null, errors: string[]}} Validation result
 */
export function validateWaterRotaStructure(structure) {
  const result = {
    isValid: false,
    hasConfigColumn: false,
    sessionColumns: [],
    configFieldId: null,
    errors: [],
  };

  const fieldMapping = structure?.fieldMapping;
  if (!fieldMapping || typeof fieldMapping !== 'object') {
    result.errors.push('Rota FlexiRecord structure has no field mapping');
    return result;
  }

  for (const [fieldId, field] of Object.entries(fieldMapping)) {
    if (field?.name === ROTA_CONFIG_COLUMN) {
      result.hasConfigColumn = true;
      result.configFieldId = fieldId;
      continue;
    }
    const session = parseSessionColumnName(field?.name);
    if (session) {
      result.sessionColumns.push({ fieldId, ...session });
    }
  }

  result.sessionColumns.sort((a, b) => a.date.localeCompare(b.date));

  if (!result.hasConfigColumn) {
    result.errors.push(`Missing required column: ${ROTA_CONFIG_COLUMN}`);
  }

  result.isValid = result.hasConfigColumn;
  return result;
}
