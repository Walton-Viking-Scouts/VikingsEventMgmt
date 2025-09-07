import React from 'react';
import PropTypes from 'prop-types';

export function MedicalDataPill({ data, type = 'info', className = '' }) {
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

  if (!data) {
    return null;
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTypeStyles(type)} ${className}`}>
      {data}
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

export default MedicalDataDisplay;