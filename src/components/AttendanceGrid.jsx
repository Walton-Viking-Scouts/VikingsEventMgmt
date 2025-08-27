import React from "react";

function AttendanceGrid({ data }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "attending":
        return "text-green-800";
      case "notAttending":
        return "text-red-800";
      case "invited":
        return "text-scout-blue";
      case "notInvited":
        return "text-gray-800";
      default:
        return "text-gray-800";
    }
  };

  const StatusCell = ({ count, status }) => (
    <td
      className={`px-3 py-2 text-center text-sm font-medium ${getStatusColor(status)}`}
      data-oid="r-rv-8e"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="wcrvaky">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="ipjjxor"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="bfb88h_"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="k37_.00"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="apl7abw"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="64xxv1a"
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
      className="overflow-hidden"
      data-oid="cvq.bwo"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="epucw:u">
        <thead className="bg-gray-50" data-oid="pd8zbk-">
          <tr data-oid="_3hhftv">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="7is:5yj"
            >
              Section
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="013_x-k"
            >
              <span data-oid="19qz455">Yes</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="-xiy5up"
            >
              <span data-oid="_5eyt2i">No</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="zbtmyf3"
            >
              <span data-oid=":kaigd-">Invited</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="-_rgu-m"
            >
              <span data-oid="wv3vvfh">Not Invited</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="g60igun">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="3hj1pvm"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="l-hkkjw">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="t:8zsrm">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="bf5k-5c"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="o1hy_fp"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="m1b8uey"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid=".66ttp."
            >
              {getTotalByStatus("notInvited")}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default AttendanceGrid;
