import React from 'react';
import { formatMedicalDataForDisplay, categorizeMedicalData, MEDICAL_DATA_STATES } from '../utils/medicalDataUtils.js';

function MedicalDataPill({ value, fieldName, className = '' }) {
  const { display, indicator } = formatMedicalDataForDisplay(value, fieldName);
  
  if (!indicator.showPill) {
    // No pill - just plain text for "None" and "Yes" cases
    return (
      <span className={`${indicator.color} ${className}`} title={indicator.description}>
        {display}
      </span>
    );
  }
  
  // Show pill with text inside for medical data and missing data
  return (
    <span 
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${indicator.pillColor} ${className}`}
      title={indicator.description}
    >
      {display}
    </span>
  );
}

function MedicalDataField({ label, value, fieldName, className = '' }) {
  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="text-sm">
        <MedicalDataPill value={value} fieldName={fieldName} />
      </div>
    </div>
  );
}

function MedicalDataSummary({ member, className = '' }) {
  const medicalFields = {
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
  };

  const states = Object.entries(medicalFields).map(([field, value]) => ({
    field,
    state: categorizeMedicalData(value, field),
    value,
  }));

  const missingCount = states.filter(s => s.state === MEDICAL_DATA_STATES.MISSING).length;
  const hasDataCount = states.filter(s => s.state === MEDICAL_DATA_STATES.HAS_DATA).length;
  
  let summaryColor = 'text-gray-600';
  let summaryIcon = '○';
  
  if (missingCount > 0) {
    summaryColor = 'text-red-600';
    summaryIcon = '⚠️';
  } else if (hasDataCount > 0) {
    summaryColor = 'text-blue-600';
    summaryIcon = '📋';
  } else {
    summaryColor = 'text-green-600';
    summaryIcon = '✓';
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span
        className={`text-sm ${summaryColor}`}
        role="img"
        aria-label={missingCount > 0 ? 'Medical data missing' : (hasDataCount > 0 ? 'Medical data present' : 'No medical data reported')}
      >
        {summaryIcon}
      </span>
      <div className="flex space-x-1">
        {states.map(({ field, value }) => (
          <MedicalDataPill 
            key={field}
            value={value} 
            fieldName={field}
            className="text-xs"
          />
        ))}
      </div>
    </div>
  );
}

export { MedicalDataPill, MedicalDataField, MedicalDataSummary };
export default MedicalDataField;