import React from 'react';

function AttendanceGrid({ data }) {
  const getStatusColor = (status) => {
    switch (status) {
    case 'attending':
      return 'text-green-800';
    case 'notAttending':
      return 'text-red-800';
    case 'invited':
      return 'text-scout-blue';
    case 'notInvited':
      return 'text-gray-800';
    default:
      return 'text-gray-800';
    }
  };

  const StatusCell = ({ count, status }) => (
    <td
      className={`px-3 py-2 text-center text-sm font-medium ${getStatusColor(status)}`}
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
      />
    </tr>
  );

  const getTotalByStatus = (status) => {
    // Use deduplicated totals if provided (for events with scouts in multiple sections)
    if (data._totals) {
      return data._totals[status] || 0;
    }

    // Otherwise sum up section counts (backward compatible)
    return Object.entries(data).reduce(
      (total, [key, typeData]) => {
        // Skip the _totals property if iterating
        if (key === '_totals') return total;
        return total + (typeData[status] || 0);
      },
      0,
    );
  };

  return (
    <div
      className="overflow-hidden"
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Section
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span>Yes</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span>No</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span>Invited</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span>Not Invited</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.entries(data)
            .filter(([key]) => key !== '_totals')
            .map(([type, typeData]) => (
              <PersonTypeRow
                key={type}
                type={type}
                typeData={typeData}
              />
            ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium">
            <td className="px-3 py-2 text-sm text-gray-900">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
            >
              {getTotalByStatus('attending')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
            >
              {getTotalByStatus('notAttending')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
            >
              {getTotalByStatus('invited')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
            >
              {getTotalByStatus('notInvited')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default AttendanceGrid;
