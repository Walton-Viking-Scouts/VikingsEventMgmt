import React from 'react';

/**
 * @file AttendanceGrid — section/group attendance table for an EventCard.
 *
 * Renders one of two layouts depending on the shape of `data`:
 *   - GROUPED (`data._grouped === true`): groups -> sections -> subtotals -> grand total
 *     Used for shared events where multiple groups participate.
 *   - FLAT (default): sections -> grand total.
 *     Used for own-group events and shared events with a single group.
 *
 * See `attendanceGridBuilder.js` for the exact shape contract.
 */

const STATUS_COLOR = {
  attending: 'text-green-800',
  notAttending: 'text-red-800',
  invited: 'text-scout-blue',
  notInvited: 'text-gray-800',
};

const TOTAL_STATUS_COLOR = {
  attending: 'text-green-800',
  notAttending: 'text-red-800',
  invited: 'text-yellow-800',
  notInvited: 'text-gray-800',
};

function CountsRow({ label, counts, labelClass = '', cellClass = '' }) {
  return (
    <tr className="border-b border-gray-200">
      <td className={`px-3 py-2 text-sm font-medium text-gray-900 bg-gray-50 ${labelClass}`}>
        {label}
      </td>
      <td className={`px-3 py-2 text-center text-sm font-medium ${STATUS_COLOR.attending} ${cellClass}`}>{counts.attending}</td>
      <td className={`px-3 py-2 text-center text-sm font-medium ${STATUS_COLOR.notAttending} ${cellClass}`}>{counts.notAttending}</td>
      <td className={`px-3 py-2 text-center text-sm font-medium ${STATUS_COLOR.invited} ${cellClass}`}>{counts.invited}</td>
      <td className={`px-3 py-2 text-center text-sm font-medium ${STATUS_COLOR.notInvited} ${cellClass}`}>{counts.notInvited}</td>
    </tr>
  );
}

function TotalsRow({ label, counts }) {
  return (
    <tr className="bg-gray-50 font-medium">
      <td className="px-3 py-2 text-sm text-gray-900">{label}</td>
      <td className={`px-3 py-2 text-center text-sm ${TOTAL_STATUS_COLOR.attending}`}>{counts.attending}</td>
      <td className={`px-3 py-2 text-center text-sm ${TOTAL_STATUS_COLOR.notAttending}`}>{counts.notAttending}</td>
      <td className={`px-3 py-2 text-center text-sm ${TOTAL_STATUS_COLOR.invited}`}>{counts.invited}</td>
      <td className={`px-3 py-2 text-center text-sm ${TOTAL_STATUS_COLOR.notInvited}`}>{counts.notInvited}</td>
    </tr>
  );
}

function GroupHeaderRow({ label }) {
  return (
    <tr className="bg-gray-100 border-t border-gray-300">
      <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-700">
        {label}
      </td>
    </tr>
  );
}

function Headers() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Yes</th>
        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Invited</th>
        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Not Invited</th>
      </tr>
    </thead>
  );
}

function sumCounts(data, status) {
  if (data._totals) return data._totals[status] || 0;
  return Object.entries(data).reduce((total, [key, typeData]) => {
    if (key === '_totals' || key === '_grouped' || key === 'groups') return total;
    return total + (typeData[status] || 0);
  }, 0);
}

function FlatBody({ data }) {
  const totals = {
    attending: sumCounts(data, 'attending'),
    notAttending: sumCounts(data, 'notAttending'),
    invited: sumCounts(data, 'invited'),
    notInvited: sumCounts(data, 'notInvited'),
  };

  const sectionEntries = Object.entries(data).filter(
    ([key]) => key !== '_totals' && key !== '_grouped' && key !== 'groups',
  );

  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {sectionEntries.map(([name, counts]) => (
        <CountsRow key={name} label={name} counts={counts} />
      ))}
      <TotalsRow label="Total" counts={totals} />
    </tbody>
  );
}

function GroupedBody({ data }) {
  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {data.groups.map((group) => (
        <React.Fragment key={group.groupname}>
          <GroupHeaderRow label={group.groupname} />
          {group.sections.map((section) => (
            <CountsRow
              key={`${group.groupname}::${section.sectionname}`}
              label={section.sectionname}
              counts={section}
              labelClass="pl-6"
            />
          ))}
          <CountsRow
            label="Subtotal"
            counts={group.subtotal}
            labelClass="pl-6 italic text-gray-700"
            cellClass="italic"
          />
        </React.Fragment>
      ))}
      <TotalsRow label="Grand total" counts={data._totals} />
    </tbody>
  );
}

function AttendanceGrid({ data }) {
  return (
    <div className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <Headers />
        {data._grouped ? <GroupedBody data={data} /> : <FlatBody data={data} />}
      </table>
    </div>
  );
}

export default AttendanceGrid;
