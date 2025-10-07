import React from 'react';
import { CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import SignInOutButton from '../SignInOutButton.jsx';
import { isFieldCleared } from '../../../../shared/constants/signInDataConstants.js';
import { formatUKDateTime } from '../../../../shared/utils/dateFormatting.js';
import { groupContactInfo } from '../../../../shared/utils/contactGroups.js';
import { categorizeMedicalData, MEDICAL_DATA_STATES } from '../../../../shared/utils/medicalDataUtils.js';

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

function RegisterTab({
  summaryStats,
  members,
  onSignInOut,
  buttonLoading,
  onMemberClick,
  sortConfig,
  onSort,
  onClearSignInData,
  clearSignInDataLoading = false,
}) {
  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    onSort({ key, direction });
  };


  // Filter for Young People only (register is primarily for Young People)
  const youngPeople = summaryStats.filter(member => member.person_type === 'Young People');

  // Calculate signed in/out counts
  const signedInCount = youngPeople.filter(member =>
    member.vikingEventData?.SignedInBy &&
    !isFieldCleared(member.vikingEventData.SignedInBy) &&
    (!member.vikingEventData?.SignedOutBy || isFieldCleared(member.vikingEventData.SignedOutBy)),
  ).length;
  const notSignedInCount = youngPeople.length - signedInCount;

  if (!youngPeople || youngPeople.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Young People Found</h3>
        <p className="text-gray-600">No young people match the current filter criteria.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status pills and Clear button */}
      <div className="flex justify-between items-center mb-4">
        {/* Status Pills */}
        <div className="flex gap-3">
          {/* Signed In Pill - Green */}
          <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-green text-white">
            Signed In: {signedInCount}
          </span>

          {/* Not Signed In Pill - Red */}
          <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm bg-scout-red text-white">
            Not Signed In: {notSignedInCount}
          </span>
        </div>

        {/* Clear All Sign-In Data Button */}
        {onClearSignInData && (
          <button
            onClick={onClearSignInData}
            disabled={clearSignInDataLoading}
            className="inline-flex items-center px-3 py-2 border border-scout-yellow shadow-sm text-sm leading-4 font-medium rounded-md text-gray-900 bg-scout-yellow hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-yellow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
            title="Clear all sign-in and sign-out data for all members"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {clearSignInDataLoading ? 'Clearing...' : 'Clear All Sign-In Data'}
          </button>
        )}
      </div>

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
            {sortData(youngPeople, sortConfig.key, sortConfig.direction).map((member, index) => (
              <tr key={member.scoutid || index} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const fullMember = members.find(m => m.scoutid.toString() === member.scoutid.toString());
                        if (fullMember) {
                          onMemberClick(fullMember);
                        }
                      }}
                      className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] text-xs"
                    >
                      {member.name}
                    </button>
                    {(() => {
                      const fullMember = members.find(m => m.scoutid.toString() === member.scoutid.toString());
                      if (!fullMember) return null;

                      const contactGroups = groupContactInfo(fullMember);
                      const consentGroup = contactGroups.consents || contactGroups.permissions;
                      const essentialInfo = contactGroups.essential_information;

                      const icons = [];

                      if (consentGroup) {
                        const photographsConsent = consentGroup.photographs || consentGroup.Photographs;
                        if (photographsConsent === 'No' || photographsConsent === 'no') {
                          icons.push(
                            <span key="camera" className="relative inline-block" title="No photography consent">
                              <CameraIcon className="w-4 h-4 text-red-600" />
                              <svg className="absolute inset-0 w-4 h-4" viewBox="0 0 24 24">
                                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" className="text-red-600" />
                              </svg>
                            </span>,
                          );
                        }
                      }

                      if (essentialInfo) {
                        const allergiesState = categorizeMedicalData(essentialInfo.allergies, 'allergies');
                        const medicalState = categorizeMedicalData(essentialInfo.medical_details, 'medical_details');
                        const dietaryState = categorizeMedicalData(essentialInfo.dietary_requirements, 'dietary_requirements');

                        const hasMedicalOrAllergies =
                          allergiesState === MEDICAL_DATA_STATES.HAS_DATA ||
                          medicalState === MEDICAL_DATA_STATES.HAS_DATA;

                        const hasDietaryRequirements = dietaryState === MEDICAL_DATA_STATES.HAS_DATA;

                        if (hasMedicalOrAllergies) {
                          icons.push(
                            <ExclamationTriangleIcon
                              key="medical"
                              className="w-4 h-4 text-yellow-600"
                              title="Has medical details or allergies"
                            />,
                          );
                        }

                        if (hasDietaryRequirements) {
                          icons.push(
                            <span key="dietary" className="text-sm" title="Has dietary requirements">
                              🍽️
                            </span>,
                          );
                        }
                      }

                      return icons.length > 0 ? icons : null;
                    })()}
                  </div>
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
    </div>
  );
}

export default RegisterTab;