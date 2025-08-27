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
      data-oid="islpvrv"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="pz37g6t">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="ixvjtvm"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="94q6ddw"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="xmr89eu"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="-gg5zvz"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="0dn1eyq"
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
      data-oid="t:uikas"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="pztaf.y">
        <thead className="bg-gray-50" data-oid="ou6ri.9">
          <tr data-oid="zxqp1kq">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="xwyho52"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="1b3yjo0"
            >
              <div className="flex flex-col items-center" data-oid="vlq7nyr">
                <div
                  className="w-3 h-3 bg-green-500 rounded-full mb-1"
                  data-oid="6a0ra-k"
                ></div>
                <span data-oid="7qjll16">Yes</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="q41dub7"
            >
              <div className="flex flex-col items-center" data-oid="e3digps">
                <div
                  className="w-3 h-3 bg-red-500 rounded-full mb-1"
                  data-oid="nn7es:z"
                ></div>
                <span data-oid="tv255cv">No</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="_w_8zy-"
            >
              <div className="flex flex-col items-center" data-oid="n5hq8el">
                <div
                  className="w-3 h-3 bg-yellow-500 rounded-full mb-1"
                  data-oid="7ka9grf"
                ></div>
                <span data-oid="ynr2_or">Invited</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="miq1a25"
            >
              <div className="flex flex-col items-center" data-oid="m4:lhj0">
                <div
                  className="w-3 h-3 bg-gray-500 rounded-full mb-1"
                  data-oid="zywc2.b"
                ></div>
                <span data-oid="fkzd0-3">Not Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="bom3px6">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="au:gqs."
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="qv1ff2o">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="d.jilrs">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="6su8otg"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="r5-c:.1"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="24r4s.6"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="_4osw88"
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
