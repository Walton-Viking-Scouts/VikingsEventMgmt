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
      data-oid="mh4fq74"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="wcne04v">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="jnk3ld6"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="dyvonoa"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="jib5vuj"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="659r3:2"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="q_gezd:"
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
      data-oid="0r0nrvh"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="1doaf09">
        <thead className="bg-gray-50" data-oid="p30bf69">
          <tr data-oid="_gm:i7v">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="hjffy2q"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="e1ikqwi"
            >
              <div className="flex flex-col items-center" data-oid=".rzbnj2">
                <div
                  className="bg-green-500 rounded-full mb-1 h-[93px] w-[69px]"
                  data-oid="0jokv2p"
                ></div>
                <span data-oid="2f7__-c">Yes</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="uh28vpr"
            >
              <div className="flex flex-col items-center" data-oid="hyc_08n">
                <div
                  className="bg-red-500 rounded-full mb-1 w-[42px] h-[39px]"
                  data-oid="-zbhbnu"
                ></div>
                <span data-oid="4wg9gp6">No</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="o96vjvs"
            >
              <div className="flex flex-col items-center" data-oid="d0zq7_c">
                <div
                  className="w-3 h-3 bg-yellow-500 rounded-full mb-1"
                  data-oid="42z0xc7"
                ></div>
                <span data-oid="vbnx4-d">Invited</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="m80_b-t"
            >
              <div className="flex flex-col items-center" data-oid="x4wacm5">
                <div
                  className="w-3 h-3 bg-gray-500 rounded-full mb-1"
                  data-oid="7yhc0mi"
                ></div>
                <span data-oid="0v4-ucl">Not Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="sie:dd_">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="s6..g3u"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid="bgdlj6.">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="r6_jx08">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="khnl6n:"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="4jymo7k"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="7-7th3m"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="19:tdd6"
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
