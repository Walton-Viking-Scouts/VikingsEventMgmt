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
      data-oid="p_g.luy"
    >
      {count}
    </td>
  );

  const PersonTypeRow = ({ type, typeData }) => (
    <tr className="border-b border-gray-200" data-oid="mf8n6pk">
      <td
        className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50"
        data-oid="47u_uwm"
      >
        {type}
      </td>
      <StatusCell
        count={typeData.attending}
        status="attending"
        data-oid="n.b2.:f"
      />

      <StatusCell
        count={typeData.notAttending}
        status="notAttending"
        data-oid="h7-016u"
      />

      <StatusCell
        count={typeData.invited}
        status="invited"
        data-oid="uq_c_8i"
      />

      <StatusCell
        count={typeData.notInvited}
        status="notInvited"
        data-oid="d4tln07"
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
      data-oid="fyuoice"
    >
      <table className="min-w-full divide-y divide-gray-200" data-oid="0.xjl:v">
        <thead className="bg-gray-50" data-oid="uktxoa8">
          <tr data-oid="t7acrio">
            <th
              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="od-xl45"
            >
              Type
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="1et9uve"
            >
              <div className="flex flex-col items-center" data-oid="ggec7r1">
                <div
                  className="w-3 h-3 bg-green-500 rounded-full mb-1"
                  data-oid="eu2z0s0"
                ></div>
                <span data-oid="3thr-rr">Yes</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="wtu3khw"
            >
              <div className="flex flex-col items-center" data-oid="guxu0vt">
                <div
                  className="w-3 h-3 bg-red-500 rounded-full mb-1"
                  data-oid="8aob3.t"
                ></div>
                <span data-oid="tdb:f11">No</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="9rdp09j"
            >
              <div className="flex flex-col items-center" data-oid=":1yz.sw">
                <div
                  className="w-3 h-3 bg-yellow-500 rounded-full mb-1"
                  data-oid="5kpo_0d"
                ></div>
                <span data-oid="322q1rj">Invited</span>
              </div>
            </th>
            <th
              className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              data-oid="wpsn-ol"
            >
              <div className="flex flex-col items-center" data-oid="x4jfkc:">
                <div
                  className="w-3 h-3 bg-gray-500 rounded-full mb-1"
                  data-oid="4ak7txx"
                ></div>
                <span data-oid="gj21j4a">Not Invited</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-oid="8kq3_4p">
          {Object.entries(data).map(([type, typeData]) => (
            <PersonTypeRow
              key={type}
              type={type}
              typeData={typeData}
              data-oid="dmvxamc"
            />
          ))}

          {/* Totals row */}
          <tr className="bg-gray-50 font-medium" data-oid=":zoe62r">
            <td className="px-3 py-2 text-sm text-gray-900" data-oid="7p3o5u-">
              Total
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-green-800"
              data-oid="dt8bh2m"
            >
              {getTotalByStatus("attending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-red-800"
              data-oid="yahi1ys"
            >
              {getTotalByStatus("notAttending")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-yellow-800"
              data-oid="0vzrag7"
            >
              {getTotalByStatus("invited")}
            </td>
            <td
              className="px-3 py-2 text-center text-sm text-gray-800"
              data-oid="ac2lg1c"
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
