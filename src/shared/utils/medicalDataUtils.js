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

export function categorizeMedicalData(value, _fieldName = '') {
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