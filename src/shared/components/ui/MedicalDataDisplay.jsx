import React from 'react';
import PropTypes from 'prop-types';
import { formatMedicalDataForDisplay, getMedicalFieldsFromMember } from '../../utils/medicalDataUtils.js';

/**
 * Render a small badge ("pill") summarising a piece of medical data.
 *
 * If `value` and `fieldName` are provided the function uses the new structured format:
 * it calls `formatMedicalDataForDisplay(value, fieldName)` and either renders a coloured pill
 * using the returned `indicator.pillColor` or, when `indicator.showPill` is false, a plain text span.
 * Otherwise it falls back to the legacy `data`/`type` inputs and maps `type` to a set of fallback styles.
 * If there is no displayable data (except the explicit placeholder `'---'`) the component returns `null`.
 *
 * @param {string|Array} [value] - New-format medical value(s). When present together with `fieldName` the value is formatted via utilities.
 * @param {string} [fieldName] - Field identifier for new-format values; used by the formatter to derive display text and indicator.
 * @param {string} [data] - Legacy plain text value used when `value`/`fieldName` are not supplied.
 * @param {'info'|'warning'|'danger'|'success'} [type='info'] - Legacy type hint used to pick fallback pill styling.
 * @param {string} [className=''] - Additional CSS classes appended to the rendered element.
 * @returns {JSX.Element|null} A styled <span> containing the display text, or `null` when there is nothing to show.
 */
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

/**
 * Render a labelled row containing a single medical-data pill.
 *
 * Renders a label and a MedicalDataPill for the given field value. The pill uses
 * the `fieldName` to determine formatting when `value` follows the newer data
 * shape; otherwise `value` may be a legacy string/array.
 *
 * @param {string} label - Visible label text for the field.
 * @param {string|Array} [value] - The field value to display (string or array); may be the new-format value expected by formatMedicalDataForDisplay.
 * @param {string} fieldName - Key identifying the medical field (used by formatting helpers).
 * @returns {JSX.Element} A labelled container with the rendered medical pill.
 */
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

/**
 * Render a compact summary pill describing whether a member has medical information.
 *
 * Uses getMedicalFieldsFromMember(member) to derive allergies, medical_details and
 * dietary_requirements. If none have values, renders a green "No medical data" pill;
 * otherwise renders an orange pill showing the number of present medical conditions
 * (pluralised).
 *
 * @param {Object} member - Member object from which medical fields are derived.
 * @returns {JSX.Element} A styled summary pill element.
 */
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