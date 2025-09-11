import React from 'react';
import PropTypes from 'prop-types';
import { formatMedicalDataForDisplay, getMedicalFieldsFromMember } from '../../utils/medicalDataUtils.js';

export function MedicalDataPill({ value, fieldName, data, type = 'info', className = '' }) {
  
  // If using the new format with value/fieldName, process the data
  let displayData, pillStyles;
  if (value !== undefined && fieldName) {
    const formatted = formatMedicalDataForDisplay(value, fieldName);
    displayData = formatted.display;
    
    // Use the indicator styles from the medical data utilities
    if (formatted.indicator.showPill) {
      pillStyles = formatted.indicator.pillColor;
    } else {
      // For "None" cases that don't show a pill, just show text
      return <span className={`text-xs ${className}`}>{formatted.display}</span>;
    }
  } else {
    // Fall back to original data/type format for backward compatibility
    displayData = data;
    const getTypeStyles = (type) => {
      switch (type) {
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'danger':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      }
    };
    pillStyles = getTypeStyles(type);
  }

  if (!displayData && displayData !== '---') {
    return null;
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${pillStyles} ${className}`}>
      {displayData}
    </span>
  );
}

export function MedicalDataList({ medicalData, className = '' }) {
  if (!medicalData || medicalData.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700">Medical Information</h4>
      <div className="space-y-1">
        {medicalData.map((item, index) => (
          <MedicalDataPill 
            key={index} 
            data={item.condition || item.text || item} 
            type={item.severity || 'info'}
          />
        ))}
      </div>
    </div>
  );
}

function MedicalDataDisplay({ member, className = '' }) {
  if (!member || !member.medicalData) {
    return null;
  }

  return (
    <div className={`medical-data-display ${className}`}>
      <MedicalDataList medicalData={member.medicalData} />
    </div>
  );
}

MedicalDataPill.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  fieldName: PropTypes.string,
  data: PropTypes.string,
  type: PropTypes.oneOf(['info', 'warning', 'danger', 'success']),
  className: PropTypes.string,
};

MedicalDataList.propTypes = {
  medicalData: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        condition: PropTypes.string,
        text: PropTypes.string,
        severity: PropTypes.string,
      }),
    ]),
  ),
  className: PropTypes.string,
};

MedicalDataDisplay.propTypes = {
  member: PropTypes.shape({
    medicalData: PropTypes.array,
  }),
  className: PropTypes.string,
};

export function MedicalDataField({ label, value, fieldName }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <MedicalDataPill 
          value={value} 
          fieldName={fieldName}
          className="text-sm"
        />
      </div>
    </div>
  );
}

export function MedicalDataSummary({ member }) {
  const medical = getMedicalFieldsFromMember(member);
  
  const hasData = medical.allergies.value || 
                  medical.medical_details.value || 
                  medical.dietary_requirements.value;
  
  if (!hasData) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 border-green-200">
        No medical data
      </span>
    );
  }

  const pillCount = [
    medical.allergies.value,
    medical.medical_details.value,
    medical.dietary_requirements.value,
  ].filter(Boolean).length;

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 border-orange-200">
      {pillCount} medical condition{pillCount !== 1 ? 's' : ''}
    </span>
  );
}

MedicalDataField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  fieldName: PropTypes.string.isRequired,
};

MedicalDataSummary.propTypes = {
  member: PropTypes.object.isRequired,
};

export default MedicalDataDisplay;