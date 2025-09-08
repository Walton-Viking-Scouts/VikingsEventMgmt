// Viking Section Movers FlexiRecord Validation Service
// Provides validation and user-friendly error messages for Viking Section Movers FlexiRecord setup

import { getVikingSectionMoversData, extractVikingSectionMoversContext } from '../../events/services/flexiRecordService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * Required fields for Viking Section Movers FlexiRecord functionality
 * These fields must exist in the FlexiRecord structure for the assignment interface to work
 */
export const REQUIRED_VIKING_SECTION_MOVERS_FIELDS = [
  {
    fieldName: 'AssignedSection',
    displayName: 'Assigned Section',
    description: 'Stores which section a member will be assigned to',
    isCore: true,
  },
  {
    fieldName: 'AssignedTerm', 
    displayName: 'Assigned Term',
    description: 'Stores which term the assignment is effective from',
    isCore: true,
  },
  {
    fieldName: 'AssignmentOverride',
    displayName: 'Assignment Override',
    description: 'Indicates if assignment overrides age-based logic (Yes/No)',
    isCore: true,
  },
  {
    fieldName: 'AssignmentDate',
    displayName: 'Assignment Date',
    description: 'Timestamp when the assignment was made',
    isCore: false,
  },
  {
    fieldName: 'AssignedBy',
    displayName: 'Assigned By',
    description: 'User who made the assignment',
    isCore: false,
  },
];

/**
 * Comprehensive validation of Viking Section Movers FlexiRecord
 * 
 * @param {string|number} sectionId - Section ID to validate
 * @param {string|number} termId - Term ID for the validation
 * @param {string} token - Authentication token
 * @param {boolean} forceRefresh - Force refresh of data cache
 * @returns {Promise<Object>} Detailed validation result with user-friendly messages
 */
export async function validateVikingSectionMoversFlexiRecord(sectionId, termId, token, forceRefresh = false) {
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
    // Step 1: Check if Viking Section Movers FlexiRecord exists
    logger.info('Validating Viking Section Movers FlexiRecord', {
      sectionId,
      termId,
    }, LOG_CATEGORIES.APP);

    const vikingSectionMoversData = await getVikingSectionMoversData(sectionId, termId, token, forceRefresh);
    
    if (!vikingSectionMoversData) {
      validation.hasFlexiRecord = false;
      validation.errors.push('Viking Section Movers FlexiRecord not found for this section');
      validation.guidance.push(
        'Create a FlexiRecord named "Viking Section Movers" in OSM with the required fields',
        'Go to OSM > Programme > Extra Records > Add Record',
        'Set Name to "Viking Section Movers" and add the required fields listed below',
      );
      
      // Add all required fields as missing
      validation.missingFields = REQUIRED_VIKING_SECTION_MOVERS_FIELDS.map(field => ({
        fieldName: field.fieldName,
        displayName: field.displayName,
        description: field.description,
        isCore: field.isCore,
      }));
      
      return validation;
    }

    validation.hasFlexiRecord = true;

    // Step 2: Extract field context and check field structure
    const fieldContext = extractVikingSectionMoversContext(vikingSectionMoversData, sectionId, termId, 'Current Section');
    
    if (!fieldContext) {
      validation.errors.push('Failed to extract field structure from Viking Section Movers FlexiRecord');
      validation.guidance.push(
        'Check that the Viking Section Movers FlexiRecord has proper field definitions',
        'Verify the FlexiRecord structure is not corrupted in OSM',
      );
      return validation;
    }

    // Step 3: Check for required fields
    const { fields: _fields, fieldMapping } = fieldContext;
    validation.availableFields = Object.keys(fieldMapping).map(fieldId => ({
      fieldId,
      fieldName: fieldMapping[fieldId].name,
      fieldType: fieldMapping[fieldId].type,
    }));

    // Check each required field
    const missingFields = [];
    const presentFields = [];

    REQUIRED_VIKING_SECTION_MOVERS_FIELDS.forEach(requiredField => {
      const fieldExists = Object.values(fieldMapping).some(field => 
        field.name === requiredField.fieldName,
      );

      if (fieldExists) {
        presentFields.push(requiredField);
      } else {
        missingFields.push({
          fieldName: requiredField.fieldName,
          displayName: requiredField.displayName,
          description: requiredField.description,
          isCore: requiredField.isCore,
        });
      }
    });

    validation.missingFields = missingFields;

    // Check if core fields are present
    const missingCoreFields = missingFields.filter(field => field.isCore);
    const missingOptionalFields = missingFields.filter(field => !field.isCore);

    validation.hasRequiredFields = missingCoreFields.length === 0;

    // Step 4: Generate appropriate messages
    if (missingCoreFields.length > 0) {
      validation.errors.push(
        `Missing ${missingCoreFields.length} required field${missingCoreFields.length > 1 ? 's' : ''}: ${missingCoreFields.map(f => f.displayName).join(', ')}`,
      );
      validation.guidance.push(
        'Add the missing required fields to your Viking Section Movers FlexiRecord in OSM',
        'Go to OSM > Programme > Extra Records > Edit "Viking Section Movers"',
        'Add the missing fields with appropriate field types (Text for most fields)',
      );
    }

    if (missingOptionalFields.length > 0) {
      validation.warnings.push(
        `Missing ${missingOptionalFields.length} optional field${missingOptionalFields.length > 1 ? 's' : ''}: ${missingOptionalFields.map(f => f.displayName).join(', ')}. These fields provide additional functionality but are not required.`,
      );
    }

    // Step 5: Overall validation status
    validation.isValid = validation.hasFlexiRecord && validation.hasRequiredFields;

    if (validation.isValid) {
      logger.info('Viking Section Movers FlexiRecord validation passed', {
        sectionId,
        termId,
        presentFields: presentFields.length,
        missingOptionalFields: missingOptionalFields.length,
      }, LOG_CATEGORIES.APP);
    } else {
      logger.warn('Viking Section Movers FlexiRecord validation failed', {
        sectionId,
        termId,
        missingCoreFields: missingCoreFields.length,
        errors: validation.errors,
      }, LOG_CATEGORIES.APP);
    }

    return validation;

  } catch (error) {
    logger.error('Error validating Viking Section Movers FlexiRecord', {
      sectionId,
      termId,
      error: error.message,
      stack: error.stack,
    }, LOG_CATEGORIES.ERROR);

    validation.errors.push(`Validation failed: ${error.message}`);
    validation.guidance.push(
      'Check your internet connection and try again',
      'Verify you have access to the section in OSM',
      'Contact support if the issue persists',
    );

    return validation;
  }
}

/**
 * Generate user-friendly error messages for Viking Section Movers validation
 * 
 * @param {Object} validation - Validation result from validateVikingSectionMoversFlexiRecord
 * @returns {Object} User-friendly messages for different scenarios
 */
export function generateVikingSectionMoversErrorMessages(validation) {
  const messages = {
    title: '',
    message: '',
    details: [],
    actionRequired: false,
    severity: 'error', // 'error', 'warning', 'info'
  };

  if (!validation.hasFlexiRecord) {
    messages.title = 'Viking Section Movers FlexiRecord Missing';
    messages.message = 'This section needs a "Viking Section Movers" FlexiRecord to use the assignment interface.';
    messages.details = [
      'Go to OSM → Programme → Extra Records',
      'Click "Add Record"',
      'Name: "Viking Section Movers"',
      'Add fields: AssignedSection, AssignedTerm, AssignmentOverride',
    ];
    messages.actionRequired = true;
    messages.severity = 'error';
    
  } else if (!validation.hasRequiredFields) {
    const coreFields = validation.missingFields.filter(f => f.isCore);
    messages.title = 'Missing Required Fields';
    messages.message = `The Viking Section Movers FlexiRecord is missing ${coreFields.length} required field${coreFields.length > 1 ? 's' : ''}.`;
    messages.details = [
      'Go to OSM → Programme → Extra Records',
      'Edit "Viking Section Movers"',
      ...coreFields.map(field => `Add field: "${field.displayName}" (${field.description})`),
    ];
    messages.actionRequired = true;
    messages.severity = 'error';
    
  } else if (validation.warnings.length > 0) {
    const optionalFields = validation.missingFields.filter(f => !f.isCore);
    messages.title = 'Optional Fields Missing';
    messages.message = `The assignment interface will work, but ${optionalFields.length} optional field${optionalFields.length > 1 ? 's are' : ' is'} missing.`;
    messages.details = [
      'These fields provide additional functionality:',
      ...optionalFields.map(field => `• ${field.displayName}: ${field.description}`),
    ];
    messages.actionRequired = false;
    messages.severity = 'warning';
    
  } else {
    messages.title = 'FlexiRecord Ready';
    messages.message = 'The Viking Section Movers FlexiRecord is properly configured for assignment tracking.';
    messages.details = [];
    messages.actionRequired = false;
    messages.severity = 'info';
  }

  return messages;
}

/**
 * Quick validation check for component use
 * Returns simple boolean with basic error info
 * 
 * @param {string|number} sectionId - Section ID to validate
 * @param {string|number} termId - Term ID for the validation
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Simple validation result
 */
export async function quickValidateVikingSectionMovers(sectionId, termId, token) {
  try {
    const validation = await validateVikingSectionMoversFlexiRecord(sectionId, termId, token, false);
    
    return {
      isValid: validation.isValid,
      hasFlexiRecord: validation.hasFlexiRecord,
      hasRequiredFields: validation.hasRequiredFields,
      errorMessage: validation.errors[0] || null,
      missingFieldsCount: validation.missingFields.filter(f => f.isCore).length,
    };
  } catch (error) {
    return {
      isValid: false,
      hasFlexiRecord: false,
      hasRequiredFields: false,
      errorMessage: `Validation failed: ${error.message}`,
      missingFieldsCount: 0,
    };
  }
}