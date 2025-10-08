import React from 'react';

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
          {attendees.sections.map((section, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900">
                {section.name}
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-green-700 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{section.yes.yp}</span>
                  <span className="w-8 text-center">{section.yes.yl}</span>
                  <span className="w-8 text-center">{section.yes.l}</span>
                  <span className="w-12 text-center">{section.yes.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-red-700 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{section.no.yp}</span>
                  <span className="w-8 text-center">{section.no.yl}</span>
                  <span className="w-8 text-center">{section.no.l}</span>
                  <span className="w-12 text-center">{section.no.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{section.invited.yp}</span>
                  <span className="w-8 text-center">{section.invited.yl}</span>
                  <span className="w-8 text-center">{section.invited.l}</span>
                  <span className="w-12 text-center">{section.invited.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{section.notInvited.yp}</span>
                  <span className="w-8 text-center">{section.notInvited.yl}</span>
                  <span className="w-8 text-center">{section.notInvited.l}</span>
                  <span className="w-12 text-center">{section.notInvited.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{section.total.yp}</span>
                  <span className="w-8 text-center">{section.total.yl}</span>
                  <span className="w-8 text-center">{section.total.l}</span>
                  <span className="w-12 text-center">{section.total.total}</span>
                </div>
              </td>
            </tr>
          ))}
          {attendees.totals && (
            <tr className="bg-gray-100 font-semibold">
              <td className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900">
                Total
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-green-700 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{attendees.totals.yes.yp}</span>
                  <span className="w-8 text-center">{attendees.totals.yes.yl}</span>
                  <span className="w-8 text-center">{attendees.totals.yes.l}</span>
                  <span className="w-12 text-center">{attendees.totals.yes.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-red-700 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{attendees.totals.no.yp}</span>
                  <span className="w-8 text-center">{attendees.totals.no.yl}</span>
                  <span className="w-8 text-center">{attendees.totals.no.l}</span>
                  <span className="w-12 text-center">{attendees.totals.no.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{attendees.totals.invited.yp}</span>
                  <span className="w-8 text-center">{attendees.totals.invited.yl}</span>
                  <span className="w-8 text-center">{attendees.totals.invited.l}</span>
                  <span className="w-12 text-center">{attendees.totals.invited.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{attendees.totals.notInvited.yp}</span>
                  <span className="w-8 text-center">{attendees.totals.notInvited.yl}</span>
                  <span className="w-8 text-center">{attendees.totals.notInvited.l}</span>
                  <span className="w-12 text-center">{attendees.totals.notInvited.total}</span>
                </div>
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold">
                <div className="flex justify-center">
                  <span className="w-8 text-center">{attendees.totals.total.yp}</span>
                  <span className="w-8 text-center">{attendees.totals.total.yl}</span>
                  <span className="w-8 text-center">{attendees.totals.total.l}</span>
                  <span className="w-12 text-center">{attendees.totals.total.total}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OverviewTab;