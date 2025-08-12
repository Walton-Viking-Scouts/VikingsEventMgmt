import React from 'react';

function AttendanceGrid({ data }) {
  const getStatusColor = (status) => {
    switch (status) {
    case 'attending':
      return 'bg-green-100 text-green-800';
    case 'notAttending':
      return 'bg-red-100 text-red-800';
    case 'invited':
      return 'bg-yellow-100 text-yellow-800';
    case 'notInvited':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
    }
  };

  const StatusCell = ({ count, status }) => (
    <td
      className={`px-3 py-2 text-center text-sm font-medium ${getStatusColor(status)}`}
      data-oid="1x39o_:"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="18wo769">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="hhatv8d"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="o5jph_h"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="vw8h3b1"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="3vq6rxo"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="n9rykkn"
      />
    </tr>
  );

  const getTotalByStatus = (status) => {
    return Object.values(data).reduce(
      (total, typeData) => total + typeData[status],
      0,
    );
  };

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200"
      data-oid="l6b74ft"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="hw.88ya">
        <thead className="bg-gray-50" data-oid="zvws7m9">
          <tr data-oid="5e4p.co">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="0gdxo1c"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="2edtkr5"
            >
              <div className="flex flex-col items-center" data-oid="mymvun:">
                <div
                  className="w-3 h-3 bg-green-500 rounded-full mb-1"
                  data-oid="n9gbu_k"
                ></div>
                <span data-oid="upruvnn">Yes</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="d5tra5f"
            >
              <div className="flex flex-col items-center" data-oid="1v-984k">
                <div
                  className="w-3 h-3 bg-red-500 rounded-full mb-1"
                  data-oid="nswruvp"
                ></div>
                <span data-oid="ox1obxx">No</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="jus_mnu"
            >
              <div className="flex flex-col items-center" data-oid="9d:s:ih">
                <div
                  className="w-3 h-3 bg-yellow-500 rounded-full mb-1"
                  data-oid="n9585cz"
                ></div>
                <span data-oid="h8qw-i5">Invited</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="ox-.q6h"
            >
              <div className="flex flex-col items-center" data-oid="o4lada:">
                <div
                  className="w-3 h-3 bg-gray-500 rounded-full mb-1"
                  data-oid="6kfhxbz"
                ></div>
                <span data-oid="zayc0y_">Not Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="td.3-l-">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="ejms00q"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="h0rkj09">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="2lfj7e6">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="2rs:.w_"
            >
              {getTotalByStatus('attending')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="i2:a3nv"
            >
              {getTotalByStatus('notAttending')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="jq3n59y"
            >
              {getTotalByStatus('invited')}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="wy5f0yb"
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
