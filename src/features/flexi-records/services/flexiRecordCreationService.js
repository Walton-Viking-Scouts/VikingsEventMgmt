/**
 * Orchestrates creation of a missing FlexiRecord (or completion of an
 * existing-but-incomplete one) for a single section.
 *
 * Handles three cases uniformly:
 *  1. FlexiRecord absent: create it, then add every template field as a column.
 *  2. FlexiRecord present but missing fields: add only the missing columns.
 *  3. FlexiRecord present with all fields: no-op success.
 *
 * Failures inside the addColumn loop are non-fatal — the function continues with
 * remaining fields and returns a partial-success result so the caller can show
 * per-field status and offer "retry failed".
 *
 * @module flexiRecordCreationService
 */

import {
  createFlexiRecord,
  addFlexiColumn,
} from '../../../shared/services/api/api/flexiRecords.js';
import {
  getFlexiRecordsList,
  getFlexiRecordStructure,
} from '../../events/services/flexiRecordService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * @typedef {Object} CreationResult
 * @property {boolean} success - True iff the FlexiRecord exists and all template fields are present after the run
 * @property {string|number|null} flexirecordid - The OSM FlexiRecord ID (existing or newly created)
 * @property {boolean} createdRecord - True if this run created a new FlexiRecord (false if it already existed)
 * @property {string[]} addedFields - Field names successfully added as columns this run
 * @property {Array<{ field: string, error: string }>} errors - Per-field errors for fields that failed to add
 */

/**
 * Extract a FlexiRecord id from an OSM response.
 *
 * The backend forwards OSM's raw JSON response; OSM's `?action=addRecordSet` shape
 * is undocumented and varies (some endpoints return `flexirecordid`, some `extraid`,
 * some `id`). Try each known key. Returns null if no id can be found.
 *
 * @private
 * @param {*} response - Whatever createFlexiRecord returned
 * @returns {string|number|null}
 */
function extractRecordId(response) {
  if (!response || typeof response !== 'object') return null;
  return response.flexirecordid
    ?? response.extraid
    ?? response.id
    ?? response.recordid
    ?? null;
}

/**
 * Read the section's flexi list and find the record matching template.name.
 * Uses cached data when possible.
 *
 * @private
 * @param {string|number} sectionId
 * @param {string} recordName
 * @param {string} token
 * @returns {Promise<Object|null>} The full OSM record entry (includes name, extraid, etc.) or null
 */
async function findExistingRecord(sectionId, recordName, token) {
  const flexiList = await getFlexiRecordsList(sectionId, token, false);
  const items = flexiList?.items || [];
  return items.find(record => record.name === recordName) || null;
}

/**
 * Get the set of field/column names already present on a FlexiRecord.
 *
 * @private
 * @param {string|number} flexirecordid
 * @param {string|number} sectionId
 * @param {string|number} termId
 * @param {string} token
 * @returns {Promise<Set<string>>}
 */
async function getExistingFieldNames(flexirecordid, sectionId, termId, token) {
  const structure = await getFlexiRecordStructure(flexirecordid, sectionId, termId, token, true);
  const fieldMapping = structure?.fieldMapping || {};
  return new Set(Object.values(fieldMapping).map(field => field.name));
}

/**
 * Create or complete a FlexiRecord on one section.
 *
 * @param {Object} params
 * @param {{ sectionid: string|number, sectionname?: string }} params.section - Section to operate on
 * @param {import('./flexiRecordTemplates.js').FlexiRecordTemplate} params.template - Required FlexiRecord template
 * @param {string|number} params.termId - Term ID used to look up the FlexiRecord structure
 * @param {string} params.token - OSM authentication token
 * @returns {Promise<CreationResult>}
 */
export async function createOrCompleteFlexiRecord({ section, template, termId, token }) {
  const sectionId = section.sectionid;
  const result = {
    success: false,
    flexirecordid: null,
    createdRecord: false,
    addedFields: [],
    errors: [],
  };

  if (!sectionId) {
    result.errors.push({ field: '_meta', error: 'Section ID is missing' });
    return result;
  }
  if (!token) {
    result.errors.push({ field: '_meta', error: 'OSM auth token is missing' });
    return result;
  }
  if (!termId) {
    result.errors.push({ field: '_meta', error: 'Term ID is missing' });
    return result;
  }

  let existingRecord;
  try {
    existingRecord = await findExistingRecord(sectionId, template.name, token);
  } catch (error) {
    logger.error('Failed to read flexi list before create', {
      sectionId,
      template: template.name,
      error: error.message,
    }, LOG_CATEGORIES.API);
    result.errors.push({ field: '_meta', error: `Failed to read flexi list: ${error.message}` });
    return result;
  }

  let existingFieldNames = new Set();

  if (existingRecord) {
    result.flexirecordid = existingRecord.extraid;
    try {
      existingFieldNames = await getExistingFieldNames(existingRecord.extraid, sectionId, termId, token);
    } catch (error) {
      logger.warn('Failed to fetch existing structure before adding columns; will attempt to add all template fields', {
        sectionId,
        flexirecordid: existingRecord.extraid,
        error: error.message,
      }, LOG_CATEGORIES.API);
    }
  } else {
    try {
      const created = await createFlexiRecord(sectionId, template.name, token, template.createOptions);
      logger.info('createFlexiRecord raw response', {
        sectionId,
        template: template.name,
        responseKeys: created && typeof created === 'object' ? Object.keys(created) : [],
        responseType: typeof created,
        responseSnippet: created !== null && created !== undefined ? JSON.stringify(created).slice(0, 300) : 'null',
      }, LOG_CATEGORIES.API);
      const newId = extractRecordId(created);
      if (newId === null || newId === undefined) {
        const detail = created?.error || `createFlexiRecord did not return a record id (got ${JSON.stringify(created)?.slice(0, 200)})`;
        result.errors.push({ field: '_meta', error: detail });
        return result;
      }
      result.flexirecordid = newId;
      result.createdRecord = true;
    } catch (error) {
      logger.error('Failed to create FlexiRecord', {
        sectionId,
        template: template.name,
        error: error.message,
      }, LOG_CATEGORIES.API);
      result.errors.push({ field: '_meta', error: `Failed to create record: ${error.message}` });
      return result;
    }
  }

  const fieldsToAdd = template.fields.filter(name => !existingFieldNames.has(name));

  for (const fieldName of fieldsToAdd) {
    try {
      const added = await addFlexiColumn(sectionId, result.flexirecordid, fieldName, token);
      if (added && typeof added === 'object' && added.error) {
        logger.warn('addFlexiColumn returned error response', {
          sectionId,
          flexirecordid: result.flexirecordid,
          fieldName,
          osmError: added.error,
          responseSnippet: JSON.stringify(added).slice(0, 300),
        }, LOG_CATEGORIES.API);
        result.errors.push({ field: fieldName, error: String(added.error) });
        continue;
      }
      logger.debug('addFlexiColumn success', {
        sectionId,
        flexirecordid: result.flexirecordid,
        fieldName,
      }, LOG_CATEGORIES.API);
      result.addedFields.push(fieldName);
    } catch (error) {
      logger.error('Failed to add FlexiRecord column', {
        sectionId,
        flexirecordid: result.flexirecordid,
        fieldName,
        error: error.message,
      }, LOG_CATEGORIES.API);
      result.errors.push({ field: fieldName, error: error.message });
    }
  }

  try {
    await getFlexiRecordsList(sectionId, token, true);
    if (result.flexirecordid) {
      await getFlexiRecordStructure(result.flexirecordid, sectionId, termId, token, true);
    }
  } catch (error) {
    logger.warn('Cache refresh after create/complete failed (non-fatal)', {
      sectionId,
      error: error.message,
    }, LOG_CATEGORIES.API);
  }

  result.success = result.errors.length === 0;
  return result;
}
