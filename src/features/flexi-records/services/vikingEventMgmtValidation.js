/**
 * Validation for the "Viking Event Mgmt" FlexiRecord.
 *
 * Sibling to vikingSectionMoversValidation — same return shape so the
 * useMissingFlexiRecords hook can dispatch over both validators uniformly.
 *
 * Required fields (must all be present for sign-in / camp-groups features to work):
 *   SignedInBy, SignedInWhen, SignedOutBy, SignedOutWhen, CampGroup
 *
 * @module vikingEventMgmtValidation
 */

import { getVikingEventData } from '../../events/services/flexiRecordService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * Required fields for Viking Event Mgmt FlexiRecord functionality.
 * All fields are core — there are no optional ones for this record.
 */
export const REQUIRED_VIKING_EVENT_MGMT_FIELDS = [
  {
    fieldName: 'SignedInBy',
    displayName: 'Signed In By',
    description: 'User who signed the member in to an event',
    isCore: true,
  },
  {
    fieldName: 'SignedInWhen',
    displayName: 'Signed In When',
    description: 'Timestamp when the member was signed in',
    isCore: true,
  },
  {
    fieldName: 'SignedOutBy',
    displayName: 'Signed Out By',
    description: 'User who signed the member out',
    isCore: true,
  },
  {
    fieldName: 'SignedOutWhen',
    displayName: 'Signed Out When',
    description: 'Timestamp when the member was signed out',
    isCore: true,
  },
  {
    fieldName: 'CampGroup',
    displayName: 'Camp Group',
    description: 'Camp group assignment shown in the camp groups view',
    isCore: true,
  },
];

/**
 * Validate the Viking Event Mgmt FlexiRecord for a section/term.
 *
 * Returns a structured result with the same shape as
 * validateVikingSectionMoversFlexiRecord so callers can treat them identically.
 *
 * @param {string|number} sectionId - Section ID
 * @param {string|number} termId - Term ID
 * @param {string} token - OSM authentication token
 * @param {boolean} [forceRefresh=false] - Bypass cache
 * @returns {Promise<Object>} Validation result
 */
export async function validateVikingEventMgmtFlexiRecord(sectionId, termId, token, forceRefresh = false) {
  const validation = {
    isValid: false,
    hasFlexiRecord: false,
    hasRequiredFields: false,
    missingFields: [],
    availableFields: [],
    errors: [],
    warnings: [],
    guidance: [],
    sectionId: String(sectionId),
    termId: String(termId),
  };

  try {
    const vikingEventData = await getVikingEventData(sectionId, termId, token, forceRefresh);

    if (!vikingEventData) {
      validation.hasFlexiRecord = false;
      validation.errors.push('Viking Event Mgmt FlexiRecord not found for this section');
      validation.missingFields = REQUIRED_VIKING_EVENT_MGMT_FIELDS.map(field => ({ ...field }));
      return validation;
    }

    validation.hasFlexiRecord = true;

    const structure = vikingEventData._structure || vikingEventData.structure;
    const fieldMapping = structure?.fieldMapping || {};

    validation.availableFields = Object.keys(fieldMapping).map(fieldId => ({
      fieldId,
      fieldName: fieldMapping[fieldId].name,
      fieldType: fieldMapping[fieldId].type,
    }));

    const presentFieldNames = new Set(
      Object.values(fieldMapping).map(field => field.name),
    );

    const missingFields = REQUIRED_VIKING_EVENT_MGMT_FIELDS
      .filter(required => !presentFieldNames.has(required.fieldName))
      .map(field => ({ ...field }));

    validation.missingFields = missingFields;
    validation.hasRequiredFields = missingFields.length === 0;
    validation.isValid = validation.hasFlexiRecord && validation.hasRequiredFields;

    if (!validation.hasRequiredFields) {
      validation.errors.push(
        `Missing ${missingFields.length} required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.map(f => f.displayName).join(', ')}`,
      );
    }

    return validation;
  } catch (error) {
    logger.error('Error validating Viking Event Mgmt FlexiRecord', {
      sectionId,
      termId,
      error: error.message,
    }, LOG_CATEGORIES.ERROR);

    validation.errors.push(`Validation failed: ${error.message}`);
    return validation;
  }
}
