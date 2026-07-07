import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getListOfMembers } from '../../../shared/services/api/api/members.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { MemberDetailModal, MedicalDataPill } from '../../../shared/components/ui/index.js';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { formatMedicalDataForDisplay } from '../../../shared/utils/medicalDataUtils.js';
import { calculateAge } from '../../../shared/utils/ageUtils.js';
import { groupContactInfo, isNotPhotoConsentYes } from '../../../shared/utils/contactGroups.js';
import { getComprehensiveMemberData as extractMemberData, csvCell, downloadCSV } from '../../../shared/utils/memberDataExtractor.js';
import { notifyError, notifySuccess, notifyWarning } from '../../../shared/utils/notifications.js';
import { resolveSectionName } from '../../../shared/utils/memberUtils.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  loadingSection = null,
  allSections,
}) {
  
  if (!sections || sections.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center p-8">
          <h2
            className="text-xl font-semibold text-gray-900 mb-2"
          >
            No Sections Available
          </h2>
          <p className="text-gray-600">
            No sections found for your account. Please check your OSM
            permissions.
          </p>
        </div>
      </div>
    );
  }




  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 m-0">Select Sections</h2>
        </div>
      </div>

      {/* Members Area - Always show the table */}
      <div className="p-4 border-t border-gray-200">
        <MembersTableContent
          sections={selectedSections}
          onSectionToggle={onSectionToggle}
          allSections={allSections}
          loadingSection={loadingSection}
        />
      </div>
    </div>
  );
}

// Members Table Content - Integrated into main card
function MembersTableContent({ sections, onSectionToggle, allSections, loadingSection }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  
  
  // Data filter state - for controlling which columns to show
  const [dataFilters, setDataFilters] = useState({
    contacts: false, // Primary and Emergency contacts (hidden by default as requested)
    photos: false,
  });

  const [memberFilters, setMemberFilters] = useState({
    noPhotoConsent: false,
    hideAdults: false,
  });

  // Load members when sections change
  useEffect(() => {
    const loadMembers = async () => {
      if (!sections || sections.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = getToken();
        const membersData = await getListOfMembers(sections, token);
        setMembers(membersData || []);
      } catch (error) {
        logger.error('Failed to load members', { error }, LOG_CATEGORIES.API);
        notifyError('Failed to load members. Please check your connection and try again.');
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [sections]);

  // Shared extractor, with local additions: identity/photo fields for the
  // avatar + photo-consent UI, age computed from date_of_birth, and consents
  // merged from both permission groups.
  const getComprehensiveMemberData = (member) => {
    const contactGroups = groupContactInfo(member);
    return {
      ...extractMemberData(member),
      firstname: member.firstname || member.first_name || '',
      lastname: member.lastname || member.last_name || '',
      scoutid: member.scoutid,
      photo_guid: member.photo_guid,
      person_type: member.person_type,
      age: calculateAge(member.date_of_birth),
      consents: {
        ...(contactGroups.permissions || {}),
        ...(contactGroups.consents || {}),
      },
    };
  };

  // Handle member click
  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  const visibleMembers = React.useMemo(() => {
    return members.filter((member) => {
      if (memberFilters.hideAdults && member.person_type === 'Leaders') {
        return false;
      }
      if (memberFilters.noPhotoConsent) {
        const contactGroups = groupContactInfo(member);
        const consents = {
          ...(contactGroups.permissions || {}),
          ...(contactGroups.consents || {}),
        };
        if (!isNotPhotoConsentYes(consents)) {
          return false;
        }
      }
      return true;
    });
  }, [members, memberFilters]);

  // Get all unique consent fields from all members for dynamic table rendering
  const allConsentFields = React.useMemo(() => {
    const fields = new Set();
    members.forEach((member) => {
      const contactGroups = groupContactInfo(member);
      // Merge both consents and permissions groups to get all fields
      [contactGroups.permissions, contactGroups.consents].forEach((group) => {
        if (group) Object.keys(group).forEach((field) => fields.add(field));
      });
    });
    return Array.from(fields).sort();
  }, [members]);

  // CSV Export function
  const exportToCSV = () => {
    if (members.length === 0) {
      notifyWarning('No members to export');
      return;
    }

    try {
      const baseHeaders = [
        'First Name',
        'Last Name',
        'Section',
        'Patrol',
        'Age',
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

      const headers = [...baseHeaders, ...consentHeaders];

      const csv = csvCell;
      const csvRows = [
        headers.map(csv).join(','),
        ...members.map((member) => {
          const memberData = getComprehensiveMemberData(member);
          
          const baseData = [
            csv(member.firstname),
            csv(member.lastname),
            csv(resolveSectionName(member)),
            csv(memberData.patrol),
            csv(memberData.age),
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

          return [...baseData, ...consentData].join(',');
        }),
      ];

      const sectionNames = sections.map(s => s.sectionname).join('_');
      const safeSectionNames = sectionNames.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];

      downloadCSV(csvRows, `sections_members_${safeSectionNames}_${dateStr}.csv`);
      
      notifySuccess(`Exported ${members.length} member records`);
    } catch (error) {
      logger.error('Error exporting CSV', { error }, LOG_CATEGORIES.USER_ACTION);
      notifyError('Failed to export member data');
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading members..." />;
  }

  return (
    <div>
      {/* Header with Export Button */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900">Members ({visibleMembers.length})</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/photo-consent')}
            type="button"
            className="inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-scout-blue text-white hover:bg-scout-blue-dark focus:ring-scout-blue px-4 py-2 text-base"
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
              <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            Photo Consent Gallery
          </button>
          {members.length > 0 && (
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
      </div>

      {/* Filter Section */}
      <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Sections:
            </label>
            <div className="flex flex-wrap gap-2">
              {allSections && allSections
                .slice()
                .sort((a, b) => {
                  const getSectionOrder = (sectionType) => {
                    const type = (sectionType ?? '').toLowerCase();
                    if (type.includes('earlyyears')) return 1;
                    if (type.includes('beavers')) return 2;
                    if (type.includes('cubs')) return 3;
                    if (type.includes('scouts')) return 4;
                    if (type.includes('adults')) return 5;
                    if (type.includes('waitinglist')) return 6;
                    return 7;
                  };
                  const getDayOrder = (sectionName) => {
                    const name = (sectionName ?? '').toLowerCase();
                    if (name.includes('monday')) return 1;
                    if (name.includes('tuesday')) return 2;
                    if (name.includes('wednesday')) return 3;
                    if (name.includes('thursday')) return 4;
                    if (name.includes('friday')) return 5;
                    if (name.includes('saturday')) return 6;
                    if (name.includes('sunday')) return 7;
                    return 8;
                  };
                  const ao = getSectionOrder(a.sectiontype);
                  const bo = getSectionOrder(b.sectiontype);
                  return ao !== bo ? ao - bo : getDayOrder(a.sectionname) - getDayOrder(b.sectionname);
                })
                .map((section) => {
                  const isSelected = sections.some(s => s.sectionid === section.sectionid);
                  const isLoading = loadingSection === section.sectionid;
                  
                  return (
                    <button
                      key={section.sectionid}
                      onClick={() => onSectionToggle(section)}
                      disabled={isLoading}
                      className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-scout-blue text-white border-scout-blue'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      {isLoading ? '...' : section.sectionname}
                    </button>
                  );
                })}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Data:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDataFilters(prev => ({ ...prev, contacts: !prev.contacts }))}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  dataFilters.contacts
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                  Contacts
              </button>
              <button
                onClick={() => setDataFilters(prev => ({ ...prev, photos: !prev.photos }))}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  dataFilters.photos
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                  Photos
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const turningOn = !memberFilters.noPhotoConsent;
                  setMemberFilters(prev => ({ ...prev, noPhotoConsent: turningOn }));
                  if (turningOn) {
                    setDataFilters(prev => ({ ...prev, photos: true }));
                  }
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  memberFilters.noPhotoConsent
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                  No Photo Consent
              </button>
              <button
                onClick={() => setMemberFilters(prev => ({ ...prev, hideAdults: !prev.hideAdults }))}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  memberFilters.hideAdults
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                  Hide Adults
              </button>
            </div>
          </div>
        </div>
      </div>

      {visibleMembers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No members found for the selected sections.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {dataFilters.photos && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photo
                  </th>
                )}

                {/* Basic Info Headers */}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                Member
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Section
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patrol
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Age
                </th>
              
                {/* Contact Info Headers - conditionally shown */}
                {dataFilters.contacts && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Primary Contacts
                  </th>
                )}
              
                {/* Emergency Contact Headers - conditionally shown */}
                {dataFilters.contacts && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                  Emergency Contacts
                  </th>
                )}
              
                {/* Essential Information Headers */}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Allergies
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Medical
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Dietary
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Tetanus
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Swimmer
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Other Info
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Confirmed By
                </th>
              
                {/* Consent Headers - Dynamic */}
                {allConsentFields.map((field) => (
                  <th key={field} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleMembers.map((member, index) => {
              // Get comprehensive member data
                const memberData = getComprehensiveMemberData(member);

                return (
                  <tr key={member.scoutid || index} className="hover:bg-gray-50 text-xs">
                    {dataFilters.photos && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <MemberAvatar member={member} size="sm" />
                      </td>
                    )}

                    {/* Basic Info Cells */}
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white">
                      <button
                        onClick={() => handleMemberClick(member)}
                        className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                      >
                        {memberData.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {memberData.section}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {memberData.patrol}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {memberData.age}
                    </td>
                  
                    {/* Contact Info Cells - conditionally shown */}
                    {dataFilters.contacts && (
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
                    {dataFilters.contacts && (
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
      )}
      
      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default SectionsList;
