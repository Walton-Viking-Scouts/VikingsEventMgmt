import React from "react";

function AttendanceGrid({ data }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "attending":
        return "bg-green-100 text-green-800";
      case "notAttending":
        return "bg-red-100 text-red-800";
      case "invited":
        return "bg-yellow-100 text-yellow-800";
      case "notInvited":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const StatusCell = ({ count, status }) => (
    <td
      className={`px-3 py-2 text-center text-sm font-medium ${getStatusColor(status)}`}
      data-oid="px3r:qe"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="ofxqkc6">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="hkw8cbx"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="v36-vog"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="5x9kkkn"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="87-6533"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="_7mkfby"
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
      data-oid="vct_ys:"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="z594fk2">
        <thead className="bg-gray-50" data-oid="2.:sae1">
          <tr data-oid="xmspaq_">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="ibi8k8g"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="b5wq5c8"
            >
              <span data-oid="x7c:fuw">Yes</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="l0-u0th"
            >
              <span data-oid="suq9c1:">No</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="97ncb7p"
            >
              <span data-oid="pbqi2o_">Invited</span>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="-prgb_5"
            >
              <span data-oid="t2735i-">Not Invited</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="o_4c6td">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="uz8zdr:"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="0x5_ass">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="jp3hnyy">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="7fm-ugv"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="zxw6692"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid=":preo8_"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="jbxntso"
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
