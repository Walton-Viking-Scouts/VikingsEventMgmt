import React from 'react';

function AttendanceGrid({ data }) {
  const getStatusColor = (status) => {
    switch (status) {
    case 'attending':
      return 'bg-green-100 text-green-800';
    case 'notAttending':
      return 'bg-red-100 text-red-800';
    case 'invited':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
    }
  };

  const StatusCell = ({ count, status }) => (
    <td className={`px-3 py-2 text-center text-sm font-medium ${getStatusColor(status)}`}>
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200">
      <td className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50">
        {type}
      </td>
      <StatusCell count={typeData.attending} status="attending" />
      <StatusCell count={typeData.notAttending} status="notAttending" />
      <StatusCell count={typeData.invited} status="invited" />
    </tr>
  );

  const getTotalByStatus = (status) => {
    return Object.values(data).reduce((total, typeData) => total + typeData[status], 0);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mb-1"></div>
                <span>Yes</span>
              </div>
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mb-1"></div>
                <span>No</span>
              </div>
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-gray-500 rounded-full mb-1"></div>
                <span>Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow key={type} type={type} typeData={typeData} />
          ))}
          
          {/* Totals row */}
          <tr className="bg-gray-50 font-medium">
            <td className="px-3 py-2 text-sm text-gray-900">
              Total
            </td>
            <td className="px-3 py-2 text-center text-sm text-green-800">
              {getTotalByStatus('attending')}
            </td>
            <td className="px-3 py-2 text-center text-sm text-red-800">
              {getTotalByStatus('notAttending')}
            </td>
            <td className="px-3 py-2 text-center text-sm text-gray-800">
              {getTotalByStatus('invited')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default AttendanceGrid;