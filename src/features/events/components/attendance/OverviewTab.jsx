import React from 'react';

/**
 * @file OverviewTab — per-section attendance breakdown by YP/YL/L on the
 *   event detail page.
 *
 * Renders one of two body variants based on the shape of `attendees`:
 *   - GROUPED (`attendees.groups` present): renders one group block per
 *     participating Scout group, with the group name as a header row, the
 *     group's sections indented, and a subtotal row per group, followed by a
 *     single grand-total row. Used when a shared event spans multiple groups.
 *   - FLAT (default): the existing per-section table plus grand total. Used
 *     for events that only involve one group.
 *
 * See `EventAttendance.overviewStats` for the data construction.
 */

function StatusCell({ counts, color }) {
  return (
    <td className={`px-2 py-3 whitespace-nowrap text-center ${color} font-semibold`}>
      <div className="flex justify-center">
        <span className="w-8 text-center">{counts.yp}</span>
        <span className="w-8 text-center">{counts.yl}</span>
        <span className="w-8 text-center">{counts.l}</span>
        <span className="w-12 text-center">{counts.total}</span>
      </div>
    </td>
  );
}

function SectionRow({ section, labelClass = '', rowClass = 'hover:bg-gray-50' }) {
  return (
    <tr className={rowClass}>
      <td className={`px-3 py-3 whitespace-nowrap table-header-text text-gray-900 ${labelClass}`}>
        {section.name}
      </td>
      <StatusCell counts={section.yes} color="text-green-700" />
      <StatusCell counts={section.no} color="text-red-700" />
      <StatusCell counts={section.invited} color="text-scout-blue" />
      <StatusCell counts={section.notInvited} color="text-gray-600" />
      <StatusCell counts={section.total} color="text-gray-900" />
    </tr>
  );
}

function TotalsRow({ label, totals, rowClass }) {
  return (
    <tr className={rowClass}>
      <td className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900">
        {label}
      </td>
      <StatusCell counts={totals.yes} color="text-green-700" />
      <StatusCell counts={totals.no} color="text-red-700" />
      <StatusCell counts={totals.invited} color="text-scout-blue" />
      <StatusCell counts={totals.notInvited} color="text-gray-600" />
      <StatusCell counts={totals.total} color="text-gray-900" />
    </tr>
  );
}

function GroupHeaderRow({ label }) {
  return (
    <tr className="bg-gray-100 border-t border-gray-300">
      <td colSpan={6} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
        {label}
      </td>
    </tr>
  );
}

function OverviewTab({
  attendees,
  members,
  onResetFilters,
}) {
  if (!attendees || !attendees.sections) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Records Match Filters
        </h3>
        <p className="text-gray-600 mb-4">
          No attendance records match your current filter settings. Try
          adjusting the filters above to see more data.
        </p>
        <button
          className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onResetFilters}
          type="button"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider">
              Section
            </th>
            <th className="px-2 py-2 text-center table-header-text text-green-700 uppercase tracking-wider">
              <div>Yes</div>
              <div className="flex justify-center mt-1 text-xs">
                <span className="w-8 text-center">YP</span>
                <span className="w-8 text-center">YL</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-center">Total</span>
              </div>
            </th>
            <th className="px-2 py-2 text-center table-header-text text-red-700 uppercase tracking-wider">
              <div>No</div>
              <div className="flex justify-center mt-1 text-xs">
                <span className="w-8 text-center">YP</span>
                <span className="w-8 text-center">YL</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-center">Total</span>
              </div>
            </th>
            <th className="px-2 py-2 text-center table-header-text text-scout-blue uppercase tracking-wider">
              <div>Invited</div>
              <div className="flex justify-center mt-1 text-xs">
                <span className="w-8 text-center">YP</span>
                <span className="w-8 text-center">YL</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-center">Total</span>
              </div>
            </th>
            <th className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider">
              <div>Not Invited</div>
              <div className="flex justify-center mt-1 text-xs">
                <span className="w-8 text-center">YP</span>
                <span className="w-8 text-center">YL</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-center">Total</span>
              </div>
            </th>
            <th className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider">
              <div>Total</div>
              <div className="flex justify-center mt-1 text-xs">
                <span className="w-8 text-center">YP</span>
                <span className="w-8 text-center">YL</span>
                <span className="w-8 text-center">L</span>
                <span className="w-12 text-center">Total</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {attendees.groups ? (
            <>
              {attendees.groups.map((group) => (
                <React.Fragment key={group.groupname}>
                  <GroupHeaderRow label={group.groupname} />
                  {group.sections.map((section, idx) => (
                    <SectionRow
                      key={`${group.groupname}::${section.name}::${idx}`}
                      section={section}
                      labelClass="pl-6"
                    />
                  ))}
                  <TotalsRow
                    label="Subtotal"
                    totals={group.subtotal}
                    rowClass="bg-gray-50 italic text-gray-700"
                  />
                </React.Fragment>
              ))}
              {attendees.totals && (
                <TotalsRow
                  label="Grand total"
                  totals={attendees.totals}
                  rowClass="bg-gray-100 font-semibold"
                />
              )}
            </>
          ) : (
            <>
              {attendees.sections.map((section, index) => (
                <SectionRow key={index} section={section} />
              ))}
              {attendees.totals && (
                <TotalsRow
                  label="Total"
                  totals={attendees.totals}
                  rowClass="bg-gray-100 font-semibold"
                />
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OverviewTab;
