export const MEDICAL_DATA_STATES = {
  MISSING: 'missing',
  CONFIRMED_NONE: 'confirmed_none', 
  SYSTEM_DEFAULT: 'system_default',
  HAS_DATA: 'has_data',
};

export const MEDICAL_DATA_INDICATORS = {
  [MEDICAL_DATA_STATES.MISSING]: {
    color: 'text-gray-900',
    showPill: true,
    pillColor: 'bg-scout-yellow text-gray-900',
    icon: '⚠️',
    label: '---',
    csvValue: '---',
    description: 'Information needs to be collected',
  },
  [MEDICAL_DATA_STATES.CONFIRMED_NONE]: {
    color: 'text-gray-700', 
    showPill: false,
    pillColor: '',
    icon: '',
    label: 'None',
    csvValue: 'None',
    description: 'Confirmed no medical requirements',
  },
  [MEDICAL_DATA_STATES.SYSTEM_DEFAULT]: {
    color: 'text-gray-900',
    showPill: true,
    pillColor: 'bg-scout-yellow text-gray-900', 
    icon: '⚠️',
    label: '---',
    csvValue: '---',
    description: 'Information needs to be collected',
  },
  [MEDICAL_DATA_STATES.HAS_DATA]: {
    color: 'text-gray-900',
    showPill: true,
    pillColor: 'bg-scout-red text-white',
    icon: '●',
    label: '',
    csvValue: '', // Use actual value
    description: 'Medical information present - review carefully',
  },
};

const NONE_VARIATIONS = [
  'none', 'nil', 'nothing',
  // Keep phrases for documentation parity; detection handled by regexes
  'not required', 'no allergies', 'no medical issues', 'no dietary requirements',
];

const SYSTEM_DEFAULTS = [
  'n/a', 'not applicable', 'default', 'system',
];

/**
 * Checks if a date string represents a date older than one year from now.
 * Used to identify stale medical confirmations that need updating.
 * @param {string} dateString - Date string in format "YYYY-MM-DD" or with additional data
 * @returns {boolean} True if the date is over one year old, false otherwise
 */
function isDateOverOneYearOld(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  
  // Extract date from start of string (format like "2025-08-26 12:24:57:Simon Clark")
  const dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return false;
  
  const confirmDate = new Date(dateMatch[1]);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return confirmDate < oneYearAgo;
}

/**
 * Categorizes medical data values into standardized states for consistent display.
 * Handles special cases for non-medical fields, swimming ability, and confirmation dates.
 * @param {*} value - The medical field value to categorize
 * @param {string} fieldName - The field name for context-specific handling
 * @returns {string} Medical data state from MEDICAL_DATA_STATES constants
 */
export function categorizeMedicalData(value, fieldName = '') {
  // Special handling for non-medical fields that shouldn't be colored
  const nonMedicalFields = ['tetanus_year_of_last_jab', 'other_useful_information'];
  if (nonMedicalFields.includes(fieldName.toLowerCase())) {
    // These fields show data without coloring (just plain text)
    if (!value || value === null || value === undefined || String(value).trim() === '') {
      return MEDICAL_DATA_STATES.MISSING; // Will show yellow "---"
    }
    return MEDICAL_DATA_STATES.CONFIRMED_NONE; // Will show plain text without pill
  }
  
  // Special handling for swimmer field - treat as safety indicator
  if (fieldName.toLowerCase() === 'swimmer') {
    if (!value || value === null || value === undefined || String(value).trim() === '') {
      return MEDICAL_DATA_STATES.MISSING; // Yellow "---" for missing swimming ability
    }
    
    const normalizedValue = String(value).toLowerCase().trim();
    if (normalizedValue === 'yes') {
      return MEDICAL_DATA_STATES.CONFIRMED_NONE; // No color for "Yes" - good swimming ability
    }
    if (normalizedValue === 'no') {
      return MEDICAL_DATA_STATES.HAS_DATA; // Red for "No" - cannot swim, safety concern
    }
    
    return MEDICAL_DATA_STATES.CONFIRMED_NONE; // Default to no color for other values
  }
  
  // Special handling for confirmed_by_parents - check date age
  if (fieldName.toLowerCase() === 'confirmed_by_parents') {
    if (!value || value === null || value === undefined || String(value).trim() === '') {
      return MEDICAL_DATA_STATES.MISSING; // Yellow "---"
    }
    
    if (isDateOverOneYearOld(String(value))) {
      return MEDICAL_DATA_STATES.HAS_DATA; // Red - confirmation is over a year old
    }
    
    return MEDICAL_DATA_STATES.CONFIRMED_NONE; // No color - recent confirmation
  }
  
  // Standard medical field handling (allergies, medical_details, dietary_requirements)
  if (!value || value === null || value === undefined) {
    return MEDICAL_DATA_STATES.MISSING;
  }

  const normalizedValue = String(value).toLowerCase().trim();
  
  if (normalizedValue === '') {
    return MEDICAL_DATA_STATES.MISSING;
  }

  if (SYSTEM_DEFAULTS.some(defaultVal => normalizedValue === defaultVal)) {
    return MEDICAL_DATA_STATES.SYSTEM_DEFAULT;
  }

  if (NONE_VARIATIONS.some(noneVal => normalizedValue.includes(noneVal))) {
    return MEDICAL_DATA_STATES.CONFIRMED_NONE;
  }

  return MEDICAL_DATA_STATES.HAS_DATA;
}

/**
 * Gets display indicator configuration for medical data based on its state.
 * Returns styling and display properties for consistent Scout-themed presentation.
 * @param {*} value - The medical field value to get indicator for
 * @param {string} fieldName - The field name for context-specific styling
 * @returns {object} Indicator configuration with color, pill styling, and labels
 */
export function getMedicalDataIndicator(value, fieldName = '') {
  const state = categorizeMedicalData(value, fieldName);
  return MEDICAL_DATA_INDICATORS[state];
}

/**
 * Formats medical data for display with appropriate text and styling indicators.
 * Handles arrays, special fields, and provides CSV-compatible formatting.
 * @param {*} value - The medical field value to format for display
 * @param {string} fieldName - The field name for context-specific formatting
 * @returns {object} Formatted display object with text, styling, and CSV values
 */
export function formatMedicalDataForDisplay(value, fieldName = '') {
  const indicator = getMedicalDataIndicator(value, fieldName);
  const state = categorizeMedicalData(value, fieldName);
  
  if (state === MEDICAL_DATA_STATES.MISSING || state === MEDICAL_DATA_STATES.SYSTEM_DEFAULT) {
    return {
      display: '---',
      value: '',
      indicator,
      csvValue: '---',
    };
  }

  if (state === MEDICAL_DATA_STATES.CONFIRMED_NONE) {
    // For non-medical fields like swimmer, show actual value instead of "None"
    const nonMedicalFields = ['tetanus_year_of_last_jab', 'other_useful_information', 'swimmer', 'confirmed_by_parents'];
    const actualValue = Array.isArray(value)
      ? value.filter(Boolean).join('; ')
      : (value ?? '').toString().trim();
    
    if (nonMedicalFields.includes(fieldName.toLowerCase()) && actualValue) {
      return {
        display: actualValue,
        value: actualValue,
        indicator,
        csvValue: actualValue,
      };
    }
    
    // For actual medical fields, show "None" when confirmed as no issues
    return {
      display: 'None',
      value: 'None',
      indicator,
      csvValue: 'None',
    };
  }

  // HAS_DATA - show actual value
  return {
    // Join arrays; coerce other types; trim for cleanliness
    display: Array.isArray(value)
      ? value.filter(Boolean).join('; ')
      : (value ?? '').toString().trim(),
    value: Array.isArray(value)
      ? value.filter(Boolean).join('; ')
      : (value ?? '').toString().trim(),
    indicator,
    csvValue: Array.isArray(value)
      ? value.filter(Boolean).join(', ')
      : (value ?? '').toString().trim(),
  };
}

/**
 * Extracts and formats all medical fields from a Scout member object.
 * Handles multiple data source formats and provides formatted display data.
 * @param {object} member - Scout member object with medical information
 * @returns {object} Formatted medical fields with display data and styling
 */
export function getMedicalFieldsFromMember(member) {
  const fields = {
    allergies: member.allergies || 
               member.essential_information?.allergies || 
               member.essential_information__allergies || '',
    medical_details: member.medical_details || 
                    member.essential_information?.medical_details || 
                    member.essential_information__medical_details || 
                    member.medical_notes || '',
    dietary_requirements: member.dietary_requirements || 
                         member.essential_information?.dietary_requirements || 
                         member.essential_information__dietary_requirements || '',
    emergency_contacts: member.emergency_contacts || [],
  };

  return Object.entries(fields).reduce((acc, [key, value]) => {
    acc[key] = formatMedicalDataForDisplay(value, key);
    return acc;
  }, {});
}