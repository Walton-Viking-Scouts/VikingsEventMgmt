import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../../shared/components/ui';
import { getListOfMembers } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { MemberDetailModal, MedicalDataPill } from '../../../shared/components/ui';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { formatMedicalDataForDisplay } from '../../../shared/utils/medicalDataUtils.js';
import { groupContactInfo } from '../../../shared/utils/contactGroups.js';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  loadingSection = null,
  allSections,
}) {
  
  if (!sections || sections.length === 0) {
    return (
      <Card data-oid="de.aoaz">
        <Card.Body className="text-center p-8" data-oid="ry9t81c">
          <h2
            className="text-xl font-semibold text-gray-900 mb-2"
            data-oid="a4t6f:."
          >
            No Sections Available
          </h2>
          <p className="text-gray-600" data-oid="fbi04qa">
            No sections found for your account. Please check your OSM
            permissions.
          </p>
        </Card.Body>
      </Card>
    );
  }




  return (
    <Card data-oid="2c.s3hh">
      <Card.Header data-oid="d7c-ou8">
        <div className="flex items-center justify-between">
          <Card.Title data-oid="solgnx_">Select Sections</Card.Title>
        </div>
      </Card.Header>

      {/* Members Area - Always show the table */}
      <Card.Body className="border-t border-gray-200">
        <MembersTableContent
          sections={selectedSections}
          onSectionToggle={onSectionToggle}
          allSections={allSections}
          loadingSection={loadingSection}
        />
      </Card.Body>
    </Card>
  );
}

// Members Table Content - Integrated into main card
function MembersTableContent({ sections, onSectionToggle, allSections, loadingSection }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const { notifyWarning, notifySuccess, notifyError } = useNotification();
  
  
  // Data filter state - for controlling which columns to show
  const [dataFilters, setDataFilters] = useState({
    contacts: false, // Primary and Emergency contacts (hidden by default as requested)
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
        console.error('Failed to load members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [sections]);

  // Use shared groupContactInfo utility

  // Extract comprehensive member data (same as AttendanceView)
  const getComprehensiveMemberData = (member) => {
    const contactGroups = groupContactInfo(member);
    
    // Helper to get field from any group
    const getField = (groupNames, fieldNames) => {
      for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
        const group = contactGroups[groupName];
        if (group) {
          for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
            if (group[fieldName]) return group[fieldName];
          }
        }
      }
      return '';
    };

    // Helper to combine multiple fields
    const combineFields = (groupNames, fieldNames, separator = ', ') => {
      const values = [];
      for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
        const group = contactGroups[groupName];
        if (group) {
          for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
            if (group[fieldName]) values.push(group[fieldName]);
          }
        }
      }
      return values.join(separator);
    };

    return {
      // Basic info
      name: `${member.firstname || member.first_name} ${member.lastname || member.last_name}`,
      section: member.sections?.[0] || 'Unknown',
      patrol: member.patrol || '',
      age: member.date_of_birth ? Math.floor((Date.now() - new Date(member.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '',
      
      // Primary Contacts (1 and 2)
      primary_contacts: (() => {
        const contacts = [];
        
        // Primary Contact 1
        const pc1_name = combineFields(['primary_contact_1'], ['first_name', 'last_name'], ' ') || '';
        const pc1_phone = combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || '';
        const pc1_email = combineFields(['primary_contact_1'], ['email_1', 'email_2']) || '';
        
        if (pc1_name || pc1_phone || pc1_email) {
          contacts.push({ name: pc1_name, phone: pc1_phone, email: pc1_email, label: 'PC1' });
        }
        
        // Primary Contact 2
        const pc2_name = combineFields(['primary_contact_2'], ['first_name', 'last_name'], ' ') || '';
        const pc2_phone = combineFields(['primary_contact_2'], ['phone_1', 'phone_2']) || '';
        const pc2_email = combineFields(['primary_contact_2'], ['email_1', 'email_2']) || '';
        
        if (pc2_name || pc2_phone || pc2_email) {
          contacts.push({ name: pc2_name, phone: pc2_phone, email: pc2_email, label: 'PC2' });
        }
        
        return contacts;
      })(),
      
      // Emergency Contacts
      emergency_contacts: (() => {
        const contacts = [];
        
        // Emergency Contact
        const ec_name = combineFields(['emergency_contact'], ['first_name', 'last_name'], ' ') || '';
        const ec_phone = combineFields(['emergency_contact'], ['phone_1', 'phone_2']) || '';
        
        if (ec_name || ec_phone) {
          contacts.push({ name: ec_name, phone: ec_phone, label: 'Emergency' });
        }
        
        return contacts;
      })(),
      
      // Essential Information
      allergies: getField(['essential_information'], ['allergies']) || '',
      medical_details: getField(['essential_information'], ['medical_details']) || '',
      dietary_requirements: getField(['essential_information'], ['dietary_requirements']) || '',
      
      // Consents
      consent_photos: getField(['consents'], ['photographs', 'photos']) || '',
      consent_sensitive: getField(['consents'], ['sensitive_information']) || '',
      consent_paracetamol: getField(['consents'], ['paracetamol']) || '',
      consent_ibuprofen: getField(['consents'], ['ibuprofen']) || '',
      consent_suncream: getField(['consents'], ['suncream', 'sun_cream']) || '',
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

  // CSV Export function
  const exportToCSV = () => {
    if (members.length === 0) {
      notifyWarning('No members to export');
      return;
    }

    try {
      const headers = [
        'First Name',
        'Last Name',
        'Section',
        'Patrol',
        'Age',
        'Allergies',
        'Medical Details',
        'Dietary Requirements',
        'Photo Consent',
        'Sensitive Info Consent',
        'Paracetamol Consent',
        'Ibuprofen Consent',
        'Suncream Consent',
      ];

      const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvRows = [
        headers.map(csv).join(','),
        ...members.map((member) => {
          const memberData = getComprehensiveMemberData(member);
          
          return [
            csv(member.firstname),
            csv(member.lastname),
            csv(member.sections?.[0] || 'Unknown'),
            csv(memberData.patrol),
            csv(memberData.age),
            csv(formatMedicalDataForDisplay(memberData.allergies, 'allergies').csvValue),
            csv(formatMedicalDataForDisplay(memberData.medical_details, 'medical_details').csvValue),
            csv(formatMedicalDataForDisplay(memberData.dietary_requirements, 'dietary_requirements').csvValue),
            csv(memberData.consent_photos || '---'),
            csv(memberData.consent_sensitive || '---'),
            csv(memberData.consent_paracetamol || '---'),
            csv(memberData.consent_ibuprofen || '---'),
            csv(memberData.consent_suncream || '---'),
          ].join(',');
        }),
      ];

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new globalThis.Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const sectionNames = sections.map(s => s.sectionname).join('_');
      const safeSectionNames = sectionNames.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      
      link.setAttribute('download', `sections_members_${safeSectionNames}_${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      
      notifySuccess(`Exported ${members.length} member records`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
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
        <h4 className="text-lg font-medium text-gray-900">Members ({members.length})</h4>
        {members.length > 0 && (
          <Button
            variant="outline"
            onClick={exportToCSV}
            type="button"
            className="flex items-center"
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
          </Button>
        )}
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
                    const type = sectionType.toLowerCase();
                    if (type.includes('earlyyears')) return 1;
                    if (type.includes('beavers')) return 2;
                    if (type.includes('cubs')) return 3;
                    if (type.includes('scouts')) return 4;
                    if (type.includes('adults')) return 5;
                    if (type.includes('waitinglist')) return 6;
                    return 7;
                  };
                  const getDayOrder = (sectionName) => {
                    const name = sectionName.toLowerCase();
                    if (name.includes('monday')) return 1;
                    if (name.includes('tuesday')) return 2;
                    if (name.includes('wednesday')) return 3;
                    if (name.includes('thursday')) return 4;
                    if (name.includes('friday')) return 5;
                    if (name.includes('saturday')) return 6;
                    if (name.includes('sunday')) return 7;
                    return 8;
                  };
                  const ao = getSectionOrder(a.section);
                  const bo = getSectionOrder(b.section);
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
            </div>
          </div>
        </div>
      </div>
        
      {members.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No members found for the selected sections.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
              
                {/* Medical Info Headers */}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Allergies
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Medical
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50 w-32">
                Dietary
                </th>
              
                {/* Consent Headers */}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Photos
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Sensitive Info
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Paracetamol
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Ibuprofen
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                Suncream
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member, index) => {
              // Get comprehensive member data
                const memberData = getComprehensiveMemberData(member);

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
                  
                    {/* Medical Info Cells - Three separate columns */}
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
                  
                    {/* Consent Cells */}
                    <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                      {
                        memberData.consent_photos === 'No' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                          No
                          </span>
                        ) : memberData.consent_photos === 'Yes' ? (
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
                    <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                      {
                        memberData.consent_sensitive === 'No' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                          No
                          </span>
                        ) : memberData.consent_sensitive === 'Yes' ? (
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
                    <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                      {
                        memberData.consent_paracetamol === 'No' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                          No
                          </span>
                        ) : memberData.consent_paracetamol === 'Yes' ? (
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
                    <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                      {
                        memberData.consent_ibuprofen === 'No' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                          No
                          </span>
                        ) : memberData.consent_ibuprofen === 'Yes' ? (
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
                    <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                      {
                        memberData.consent_suncream === 'No' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-scout-red text-white">
                          No
                          </span>
                        ) : memberData.consent_suncream === 'Yes' ? (
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
