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

/**
 * Common variations parents/leaders use to indicate "no medical issues/allergies/requirements"
 * Split into exact matches (short values) and phrase patterns (word-boundary regex)
 * Used for consistent empty value detection across components (DetailedTab sorting, etc.)
 * @constant {Object}
 */
export const NONE_VARIATIONS = {
  // Short values requiring exact equality match to avoid false positives
  exact: ['no', 'na'],
  // Longer phrases safe for word-boundary regex matching
  phrases: [
    'none', 'nil', 'nothing',
    'not required', 'no allergies', 'no medical issues', 'no dietary requirements',
  ],
};

/**
 * System-generated default values indicating missing or not-applicable data
 * Used to distinguish between user-entered content and auto-populated placeholders
 * @constant {string[]}
 */
export const SYSTEM_DEFAULTS = [
  'n/a', 'not applicable', 'default', 'system',
];

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

  // Check exact matches for short values (no, na) to avoid false positives
  if (NONE_VARIATIONS.exact.some(exactVal => normalizedValue === exactVal)) {
    return MEDICAL_DATA_STATES.CONFIRMED_NONE;
  }

  // Check phrase patterns with word boundaries to avoid substring false positives
  const noneRegex = new RegExp(`\\b(${NONE_VARIATIONS.phrases.join('|')})\\b`, 'i');
  if (noneRegex.test(value)) {
    return MEDICAL_DATA_STATES.CONFIRMED_NONE;
  }

  return MEDICAL_DATA_STATES.HAS_DATA;
}

export function getMedicalDataIndicator(value, fieldName = '') {
  const state = categorizeMedicalData(value, fieldName);
  return MEDICAL_DATA_INDICATORS[state];
}

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