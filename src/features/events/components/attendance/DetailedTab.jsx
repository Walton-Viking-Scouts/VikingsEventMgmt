import React, { useState } from 'react';
import { MedicalDataPill } from '../../../../shared/components/ui';
import { formatMedicalDataForDisplay, NONE_VARIATIONS, SYSTEM_DEFAULTS } from '../../../../shared/utils/medicalDataUtils.js';
import { groupContactInfo } from '../../../../shared/utils/contactGroups.js';
import { notifyError, notifySuccess, notifyWarning } from '../../../../shared/utils/notifications.js';
import { getComprehensiveMemberData, csvCell, downloadCSV } from '../../../../shared/utils/memberDataExtractor.js';

function DetailedTab({ attendees, members, onMemberClick, showContacts = false }) {
  const [sortConfig, setSortConfig] = useState({ key: 'age', direction: 'desc' });

  // Get all unique consent fields from all members for dynamic table rendering
  // Must be before early return to satisfy Rules of Hooks
  const allConsentFields = React.useMemo(() => {
    const fields = new Set();
    if (attendees && members) {
      attendees.forEach((attendee) => {
        const member = members.find(m => m.scoutid.toString() === attendee.scoutid.toString()) || {};
        const contactGroups = groupContactInfo(member);
        const consentGroup = contactGroups.consents || contactGroups.permissions;
        if (consentGroup) {
          Object.keys(consentGroup).forEach(field => fields.add(field));
        }
      });
    }
    return Array.from(fields).sort();
  }, [attendees, members]);

  const getMemberAttendanceStatus = React.useCallback((attendee) => {
    if (attendee.yes > 0) return 'Yes';
    if (attendee.no > 0) return 'No';
    if (attendee.invited > 0) return 'Invited';
    if (attendee.notInvited > 0) return 'Not Invited';
    return 'Unknown';
  }, []);

  const getMemberVikingEventData = React.useCallback((attendee) => {
    return attendee?.vikingEventData || null;
  }, []);

  // Precompute the row model ONCE per data change. The previous comparator
  // called members.find() + full contact-group parsing for BOTH operands on
  // EVERY comparison — O(n^2 · parse) per header click on a 200-member camp.
  const memberById = React.useMemo(
    () => new Map((members || []).map(m => [String(m.scoutid), m])),
    [members],
  );

  const rowModel = React.useMemo(() => {
    if (!attendees) return [];
    return attendees.map(attendee => {
      const member = memberById.get(String(attendee.scoutid)) || {};
      return {
        attendee,
        member,
        data: getComprehensiveMemberData(member),
        status: getMemberAttendanceStatus(attendee),
        vikingEventData: getMemberVikingEventData(attendee),
      };
    });
  }, [attendees, memberById, getMemberAttendanceStatus, getMemberVikingEventData]);

  const sortedStats = React.useMemo(() => {
    if (!sortConfig.key) return attendees;

    const isEmptyValue = (val) => {
      if (!val || val === '' || val === '---') return true;
      const normalized = String(val).toLowerCase().trim();
      if (normalized === '') return true;
      if (SYSTEM_DEFAULTS.some(def => normalized === def)) return true;
      if (NONE_VARIATIONS.exact.some(exactVal => normalized === exactVal)) return true;
      const noneRegex = new RegExp(`\\b(${NONE_VARIATIONS.phrases.join('|')})\\b`, 'i');
      if (noneRegex.test(val)) return true;
      return false;
    };

    const sortValue = (row) => {
      switch (sortConfig.key) {
      case 'name': return row.data.name.toLowerCase();
      case 'section': return row.data.section.toLowerCase();
      case 'patrol': return row.data.patrol.toLowerCase();
      case 'age': return parseInt(row.data.age) || 0;
      case 'status': return row.status.toLowerCase();
      case 'campGroup': return (row.vikingEventData?.CampGroup || '').toLowerCase();
      default:
        if (allConsentFields.includes(sortConfig.key)) {
          return (row.data.consents?.[sortConfig.key] || '').toLowerCase();
        }
        return String(row.data[sortConfig.key] || '').toLowerCase();
      }
    };

    const sorted = [...rowModel].sort((a, b) => {
      const aValue = sortValue(a);
      const bValue = sortValue(b);

      const aIsEmpty = isEmptyValue(aValue);
      const bIsEmpty = isEmptyValue(bValue);

      if (aIsEmpty && !bIsEmpty) return 1;
      if (!aIsEmpty && bIsEmpty) return -1;
      if (aIsEmpty && bIsEmpty) return 0;

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted.map(row => row.attendee);
  }, [attendees, rowModel, sortConfig, allConsentFields]);

  if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
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

  const handleMemberClick = (member) => {
    onMemberClick(member);
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // CSV Export function
  const exportToCSV = () => {
    if (!attendees || attendees.length === 0) {
      notifyWarning('No members to export');
      return;
    }

    try {
      const baseHeaders = [
        'First Name',
        'Last Name',
        'Event Status',
        'Camp Group',
        'Section',
        'Patrol',
        'Age',
      ];

      const contactHeaders = showContacts ? [
        'PC1 Name',
        'PC1 Phone',
        'PC1 Email',
        'PC2 Name',
        'PC2 Phone',
        'PC2 Email',
        'Emergency Contact Name',
        'Emergency Contact Phone',
      ] : [];

      const medicalHeaders = [
        'Allergies',
        'Medical Details',
        'Dietary Requirements',
        'Tetanus Year',
        'Swimmer',
        'Other Info',
        'Confirmed By',
      ];

      const consentHeaders = allConsentFields.map(field =>
        field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      );

      const headers = [...baseHeaders, ...contactHeaders, ...medicalHeaders, ...consentHeaders];

      const csv = csvCell;
      const csvRows = [
        headers.map(csv).join(','),
        ...attendees.map((attendee) => {
          const member = members.find(m => m.scoutid.toString() === attendee.scoutid.toString()) || {};
          const memberData = getComprehensiveMemberData(member);
          const attendanceStatus = getMemberAttendanceStatus(attendee);
          const vikingEventData = getMemberVikingEventData(attendee);

          const sectionName = attendee.sectionDisplayName || attendee.sectionname || 'Unknown';

          const baseData = [
            csv(member.firstname),
            csv(member.lastname),
            csv(attendanceStatus),
            csv(vikingEventData?.CampGroup || ''),
            csv(sectionName),
            csv(memberData.patrol),
            csv(memberData.age),
          ];

          const contactData = showContacts ? [
            csv(memberData.primary_contacts[0]?.name || ''),
            csv(memberData.primary_contacts[0]?.phone || ''),
            csv(memberData.primary_contacts[0]?.email || ''),
            csv(memberData.primary_contacts[1]?.name || ''),
            csv(memberData.primary_contacts[1]?.phone || ''),
            csv(memberData.primary_contacts[1]?.email || ''),
            csv(memberData.emergency_contacts[0]?.name || ''),
            csv(memberData.emergency_contacts[0]?.phone || ''),
          ] : [];

          const medicalData = [
            csv(formatMedicalDataForDisplay(memberData.allergies, 'allergies').csvValue),
            csv(formatMedicalDataForDisplay(memberData.medical_details, 'medical_details').csvValue),
            csv(formatMedicalDataForDisplay(memberData.dietary_requirements, 'dietary_requirements').csvValue),
            csv(formatMedicalDataForDisplay(memberData.tetanus_year_of_last_jab, 'tetanus_year_of_last_jab').csvValue),
            csv(formatMedicalDataForDisplay(memberData.swimmer, 'swimmer').csvValue),
            csv(formatMedicalDataForDisplay(memberData.other_useful_information, 'other_useful_information').csvValue),
            csv(formatMedicalDataForDisplay(memberData.confirmed_by_parents, 'confirmed_by_parents').csvValue),
          ];

          const consentData = allConsentFields.map(field =>
            csv(memberData.consents?.[field] || '---'),
          );

          return [...baseData, ...contactData, ...medicalData, ...consentData].join(',');
        }),
      ];

      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(csvRows, `event_attendance_detailed_${dateStr}.csv`);

      notifySuccess(`Exported ${attendees.length} member records`);
    } catch (error) {
      notifyError('Failed to export attendance data');
    }
  };

  // Helper component for sortable column headers
  const SortableHeader = ({ columnKey, children, className = '' }) => {
    const isSorted = sortConfig.key === columnKey;
    const sortDirection = isSorted ? sortConfig.direction : undefined;

    return (
      <th
        className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
        onClick={() => handleSort(columnKey)}
        aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        role="columnheader"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSort(columnKey);
          }
        }}
      >
        <div className="flex items-center gap-1">
          {children}
          {isSorted && (
            <span className="text-gray-400" aria-label={`Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}>
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div>
      {/* Header with Export Button */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900">
          Detailed Attendance ({attendees?.length || 0} members)
        </h4>
        {attendees && attendees.length > 0 && (
          <button
            onClick={exportToCSV}
            type="button"
            className="inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 px-4 py-2 text-base"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            >
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Basic Info Headers */}
              <SortableHeader columnKey="name" className="sticky left-0 bg-gray-50">
                Member
              </SortableHeader>
              <SortableHeader columnKey="status" className="bg-purple-50">
                Event Status
              </SortableHeader>
              <SortableHeader columnKey="campGroup" className="bg-purple-50">
                Camp Group
              </SortableHeader>
              <SortableHeader columnKey="section">
                Section
              </SortableHeader>
              <SortableHeader columnKey="patrol">
                Patrol
              </SortableHeader>
              <SortableHeader columnKey="age">
                Age
              </SortableHeader>
            
              {/* Contact Info Headers - conditionally shown */}
              {showContacts && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Primary Contacts
                </th>
              )}
            
              {/* Emergency Contact Headers - conditionally shown */}
              {showContacts && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                  Emergency Contacts
                </th>
              )}
            
              {/* Essential Information Headers */}
              <SortableHeader columnKey="allergies" className="bg-orange-50 w-32">
                Allergies
              </SortableHeader>
              <SortableHeader columnKey="medical_details" className="bg-orange-50 w-32">
                Medical
              </SortableHeader>
              <SortableHeader columnKey="dietary_requirements" className="bg-orange-50 w-32">
                Dietary
              </SortableHeader>
              <SortableHeader columnKey="tetanus_year_of_last_jab" className="bg-orange-50 w-32">
                Tetanus
              </SortableHeader>
              <SortableHeader columnKey="swimmer" className="bg-orange-50 w-32">
                Swimmer
              </SortableHeader>
              <SortableHeader columnKey="other_useful_information" className="bg-orange-50 w-32">
                Other Info
              </SortableHeader>
              <SortableHeader columnKey="confirmed_by_parents" className="bg-orange-50 w-32">
                Confirmed By
              </SortableHeader>

              {/* Consent Headers - Dynamic */}
              {allConsentFields.map((field) => (
                <SortableHeader key={field} columnKey={field} className="bg-green-50">
                  {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SortableHeader>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedStats.map((attendee, index) => {
              // Get comprehensive member data from the full members list
              const member = members.find(m => m.scoutid.toString() === attendee.scoutid.toString()) || {};
              const memberData = getComprehensiveMemberData(member);
              const attendanceStatus = getMemberAttendanceStatus(attendee);
              const vikingEventData = getMemberVikingEventData(attendee);

              return (
                <tr key={member.scoutid || index} className="hover:bg-gray-50 text-xs">
                  {/* Basic Info Cells */}
                  <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white">
                    <button
                      onClick={() => handleMemberClick(member)}
                      className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                    >
                      {memberData.name}
                    </button>
                  </td>
                  
                  {/* Event Status */}
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-purple-25">
                    {(() => {
                      if (attendanceStatus === 'Yes') return <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-green text-white">Yes</span>;
                      if (attendanceStatus === 'No') return <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-red text-white">No</span>;
                      if (attendanceStatus === 'Invited') return <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-scout-blue text-white">Invited</span>;
                      if (attendanceStatus === 'Not Invited') return <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-gray-50 text-gray-600 border border-gray-200">Not Invited</span>;
                      return <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-xs bg-gray-50 text-gray-600 border border-gray-200">Unknown</span>;
                    })()}
                  </td>
                  
                  {/* Camp Group from Viking Event Data */}
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900 bg-purple-25">
                    {vikingEventData?.CampGroup || '-'}
                  </td>
                  
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {attendee.sectionDisplayName || attendee.sectionname || 'Unknown'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {memberData.patrol}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {memberData.age}
                  </td>
                
                  {/* Contact Info Cells - conditionally shown */}
                  {showContacts && (
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 bg-blue-25">
                      {memberData.primary_contacts.length > 0 ? (
                        <div className="space-y-1">
                          {memberData.primary_contacts.map((contact, index) => (
                            <div key={index} className="text-xs">
                              <div className="font-medium">{contact.label}: {contact.name}</div>
                              {contact.phone && <div className="text-gray-600">📞 {contact.phone}</div>}
                              {contact.email && <div className="text-gray-600">📧 {contact.email}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                  )}
                
                  {/* Emergency Contact Cells - conditionally shown */}
                  {showContacts && (
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900 bg-red-25">
                      {memberData.emergency_contacts.length > 0 ? (
                        <div className="space-y-1">
                          {memberData.emergency_contacts.map((contact, index) => (
                            <div key={index} className="text-xs">
                              <div className="font-medium">{contact.name}</div>
                              {contact.phone && <div className="text-gray-600">📞 {contact.phone}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                  )}
                
                  {/* Essential Information Cells - Six comprehensive columns */}
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.allergies} 
                        fieldName="allergies"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.medical_details} 
                        fieldName="medical_details"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.dietary_requirements} 
                        fieldName="dietary_requirements"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.tetanus_year_of_last_jab} 
                        fieldName="tetanus_year_of_last_jab"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.swimmer} 
                        fieldName="swimmer"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.other_useful_information} 
                        fieldName="other_useful_information"
                        className="text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-[8rem] break-words">
                      <MedicalDataPill 
                        value={memberData.confirmed_by_parents} 
                        fieldName="confirmed_by_parents"
                        className="text-xs"
                      />
                    </div>
                  </td>
                
                  {/* Consent Cells - Dynamic */}
                  {allConsentFields.map((field) => {
                    const value = memberData.consents?.[field];
                    return (
                      <td key={field} className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                        {
                          value === 'No' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                              No
                            </span>
                          ) : value === 'Yes' ? (
                            <span className="text-xs text-gray-700">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-yellow text-gray-900">
                              ---
                            </span>
                          )
                        }
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DetailedTab;