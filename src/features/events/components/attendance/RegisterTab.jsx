import React from 'react';
import SignInOutButton from '../SignInOutButton.jsx';

const formatUKDateTime = (dateString) => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to format date:', dateString, error);
    }
    return dateString;
  }
};

const sortData = (data, key, direction) => {
  return [...data].sort((a, b) => {
    let aValue, bValue;

    switch (key) {
    case 'member':
      aValue = a.name?.toLowerCase() || '';
      bValue = b.name?.toLowerCase() || '';
      break;
    case 'attendance':
      aValue = a.yes + a.no + a.invited + a.notInvited;
      bValue = b.yes + b.no + b.invited + b.notInvited;
      break;
    default:
      aValue = '';
      bValue = '';
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

const getSortIcon = (columnKey, currentSortKey, direction) => {
  if (currentSortKey !== columnKey) {
    return (
      <span className="ml-1 text-gray-400">
        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </span>
    );
  }

  return direction === 'asc' ? (
    <span className="ml-1 text-scout-blue">
      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    </span>
  ) : (
    <span className="ml-1 text-scout-blue">
      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
};

/**
 *
 * @param root0
 * @param root0.summaryStats
 * @param root0.members
 * @param root0.onSignInOut
 * @param root0.buttonLoading
 * @param root0.onMemberClick
 * @param root0.sortConfig
 * @param root0.onSort
 */
function RegisterTab({ 
  summaryStats,
  members,
  onSignInOut,
  buttonLoading,
  onMemberClick,
  sortConfig,
  onSort, 
}) {
  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    onSort({ key, direction });
  };

  if (!summaryStats || summaryStats.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Members Found</h3>
        <p className="text-gray-600">No members match the current filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('member')}
            >
              <div className="flex items-center">
                Member {getSortIcon('member', sortConfig.key, sortConfig.direction)}
              </div>
            </th>
            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('attendance')}
            >
              <div className="flex items-center">
                Status {getSortIcon('attendance', sortConfig.key, sortConfig.direction)}
              </div>
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Camp Group
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Signed In
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Signed Out
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortData(summaryStats, sortConfig.key, sortConfig.direction).map((member, index) => (
            <tr key={member.scoutid || index} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <button
                  onClick={() => {
                    const fullMember = members.find(m => m.scoutid.toString() === member.scoutid.toString());
                    if (fullMember) {
                      onMemberClick(fullMember);
                    }
                  }}
                  className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] block text-xs"
                >
                  {member.name}
                </button>
              </td>
              <td className="px-2 py-2 text-center">
                <SignInOutButton
                  member={member}
                  onSignInOut={onSignInOut}
                  loading={buttonLoading?.[member.scoutid] || false}
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex gap-1 flex-wrap">
                  {member.yes > 0 && (
                    <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-green text-white">
                      Yes
                    </span>
                  )}
                  {member.no > 0 && (
                    <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-red text-white">
                      No
                    </span>
                  )}
                  {member.invited > 0 && (
                    <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-blue text-white">
                      Invited
                    </span>
                  )}
                  {member.notInvited > 0 && (
                    <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-gray-50 text-gray-600 border border-gray-200">
                      Not Invited
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                {member.vikingEventData?.CampGroup || '-'}
              </td>
              <td className="px-3 py-2 text-xs">
                {member.vikingEventData?.SignedInBy || member.vikingEventData?.SignedInWhen ? (
                  <div className="space-y-0.5">
                    <div className="text-gray-900 font-medium leading-tight">
                      {member.vikingEventData?.SignedInBy || '-'}
                    </div>
                    <div className="text-gray-500 text-xs leading-tight">
                      {member.vikingEventData?.SignedInWhen
                        ? formatUKDateTime(member.vikingEventData.SignedInWhen)
                        : '-'
                      }
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs">
                {member.vikingEventData?.SignedOutBy || member.vikingEventData?.SignedOutWhen ? (
                  <div className="space-y-0.5">
                    <div className="text-gray-900 font-medium leading-tight">
                      {member.vikingEventData?.SignedOutBy || '-'}
                    </div>
                    <div className="text-gray-500 text-xs leading-tight">
                      {member.vikingEventData?.SignedOutWhen
                        ? formatUKDateTime(member.vikingEventData.SignedOutWhen)
                        : '-'
                      }
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RegisterTab;