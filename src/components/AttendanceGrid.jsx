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
      data-oid="mbqb9y3"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="bymcdj:">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="ifwfwv8"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="jga.w1g"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="43-vm9t"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="timtoo2"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="qpkdxs6"
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
      data-oid="_-6j65u"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="ojsjlbs">
        <thead className="bg-gray-50" data-oid="o18-p4y">
          <tr data-oid="twzdct5">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="fxn0cx_"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="rs63_-y"
            >
              <div className="flex flex-col items-center" data-oid="lejlc.0">
                <div
                  className="w-3 h-3 bg-green-500 rounded-full mb-1"
                  data-oid="_8txzru"
                ></div>
                <span data-oid="lu:5foo">Yes</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="gmp204c"
            >
              <div className="flex flex-col items-center" data-oid="yiv9_4z">
                <div
                  className="w-3 h-3 bg-red-500 rounded-full mb-1"
                  data-oid="mjdir.s"
                ></div>
                <span data-oid="a9fhjap">No</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid=":cppi_c"
            >
              <div className="flex flex-col items-center" data-oid="dkdi029">
                <div
                  className="w-3 h-3 bg-yellow-500 rounded-full mb-1"
                  data-oid="wo28e90"
                ></div>
                <span data-oid="4d1ln6d">Invited</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="72-qm_e"
            >
              <div className="flex flex-col items-center" data-oid="94.hixr">
                <div
                  className="w-3 h-3 bg-gray-500 rounded-full mb-1"
                  data-oid="llj.rb4"
                ></div>
                <span data-oid=":.ci4xt">Not Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="aavbuml">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="ysvuli:"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="8je:ww6">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="c6o8ouh">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="3ajj1bv"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="g33z:5v"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="ae6tvsj"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="b4bpq9u"
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
