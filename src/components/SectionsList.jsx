import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import MemberDetailModal from './MemberDetailModal.jsx';
import LoadingScreen from './LoadingScreen.jsx';

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  loadingSection = null,
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

  const isSectionSelected = (sectionId) => {
    return selectedSections.some((s) => s.sectionid === sectionId);
  };

  const getSectionOrder = (sectionType) => {
    const type = sectionType.toLowerCase();
    if (type.includes('earlyyears')) return 1;
    if (type.includes('beavers')) return 2;
    if (type.includes('cubs')) return 3;
    if (type.includes('scouts')) return 4;
    if (type.includes('adults')) return 5;
    if (type.includes('waitinglist')) return 6;
    return 7; // Unknown sections at the end
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
    return 8; // No day mentioned - put at end
  };

  const sortedSections = [...sections].sort((a, b) => {
    const sectionOrderA = getSectionOrder(a.section);
    const sectionOrderB = getSectionOrder(b.section);

    // First sort by section type
    if (sectionOrderA !== sectionOrderB) {
      return sectionOrderA - sectionOrderB;
    }

    // Then sort by day of the week within same section type
    return getDayOrder(a.sectionname) - getDayOrder(b.sectionname);
  });

  return (
    <Card data-oid="2c.s3hh">
      <Card.Header data-oid="d7c-ou8">
        <Card.Title data-oid="solgnx_">Select Sections</Card.Title>
      </Card.Header>

      <Card.Body data-oid="ri-w62l">
        <div
          className="flex flex-wrap justify-center"
          style={{ gap: '30px' }}
          data-oid="yuqpqw4"
        >
          {sortedSections.map((section) => {
            const isSelected = isSectionSelected(section.sectionid);
            const isLoading = loadingSection === section.sectionid;
            const sectionType = section.section.toLowerCase();

            // Determine background color based on section type
            let bgColor, hoverBgColor;
            if (sectionType.includes('earlyyears')) {
              bgColor = 'var(--scout-red)';
              hoverBgColor = 'var(--scout-red-dark)';
            } else if (sectionType.includes('beavers')) {
              bgColor = 'var(--scout-blue)';
              hoverBgColor = 'var(--scout-blue-dark)';
            } else if (sectionType.includes('cubs')) {
              bgColor = 'var(--scout-forest-green)';
              hoverBgColor = 'var(--scout-forest-green-dark)';
            } else if (sectionType.includes('scouts')) {
              bgColor = 'var(--scout-navy)';
              hoverBgColor = 'var(--scout-navy-dark)';
            } else if (sectionType.includes('adults')) {
              bgColor = 'var(--scout-purple)';
              hoverBgColor = 'var(--scout-purple-dark)';
            } else if (sectionType.includes('waitinglist')) {
              bgColor = 'var(--scout-teal)';
              hoverBgColor = 'var(--scout-teal-dark)';
            } else {
              bgColor = 'var(--scout-purple)';
              hoverBgColor = 'var(--scout-purple-dark)';
            }

            return (
              <button
                key={section.sectionid}
                onClick={() => onSectionToggle(section)}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  backgroundColor: isSelected ? hoverBgColor : bgColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  minWidth: '120px',
                  opacity: isLoading ? 0.6 : isSelected ? 1 : 0.8,
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = hoverBgColor;
                    e.target.style.opacity = 1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = isSelected
                      ? hoverBgColor
                      : bgColor;
                    e.target.style.opacity = isSelected ? 1 : 0.8;
                  }
                }}
                data-oid="-w7mq5i"
              >
                {isLoading && (
                  <svg
                    className="animate-spin h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    data-oid="glzlpdi"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      data-oid="6:yirah"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      data-oid="v:9ro8w"
                    ></path>
                  </svg>
                )}
                {isLoading ? 'Loading...' : section.sectionname}
              </button>
            );
          })}
        </div>
      </Card.Body>

      {/* Members Area - Show when sections are selected */}
      {selectedSections && selectedSections.length > 0 && (
        <Card.Body
          className="border-t border-gray-200 bg-gray-50"
          data-oid="wa.lpc0"
        >
          <div className="mb-4" data-oid="y726obn">
            <h4
              className="text-lg font-semibold text-gray-900"
              data-oid="yv1hpdq"
            >
              Members from {selectedSections.length} section
              {selectedSections.length === 1 ? '' : 's'}
            </h4>
            <p className="text-sm text-gray-600" data-oid="r.rco_f">
              {selectedSections.map((s) => s.sectionname).join(', ')}
            </p>
          </div>

          {/* Comprehensive Members Table - Same as AttendanceView detailed */}
          <ComprehensiveMembersTable
            sections={selectedSections}
            data-oid="v7s6d.-"
          />
        </Card.Body>
      )}
    </Card>
  );
}

// Comprehensive Members Table - Same implementation as AttendanceView detailed tab
function ComprehensiveMembersTable({ sections }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  
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

  // Helper function to group contact information (same as AttendanceView)
  const groupContactInfo = (member) => {
    const groups = {};

    // Process flattened contact fields
    Object.entries(member).forEach(([key, value]) => {
      if (key.includes('__') && value) {
        const [groupName, fieldName] = key.split('__');
        if (!groups[groupName]) {
          groups[groupName] = {};
        }
        groups[groupName][fieldName] = value;
      }
    });

    // Add legacy fields to appropriate groups
    if (member.email || member.phone) {
      if (!groups.member_contact) {
        groups.member_contact = {};
      }
      if (member.email) groups.member_contact.email = member.email;
      if (member.phone) groups.member_contact.phone = member.phone;
    }

    // Also process nested contact_groups data if available
    if (member.contact_groups) {
      Object.entries(member.contact_groups).forEach(([groupName, groupData]) => {
        if (groupData && typeof groupData === 'object') {
          const normalizedGroupName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
          if (!groups[normalizedGroupName]) {
            groups[normalizedGroupName] = {};
          }
          // Merge nested data with flattened data (nested takes precedence)
          Object.entries(groupData).forEach(([fieldName, fieldValue]) => {
            if (fieldValue) {
              const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
              groups[normalizedGroupName][normalizedFieldName] = fieldValue;
            }
          });
        }
      });
    }

    return groups;
  };

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

  if (loading) {
    return <LoadingScreen message="Loading members..." />;
  }

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No members found for the selected sections.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Filter Section */}
      <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3">
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
                    <div className="max-w-32 break-words text-xs">
                      <span className={memberData.allergies ? 'text-orange-700 font-medium' : 'text-gray-400'}>
                        {memberData.allergies || 'None'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-32 break-words text-xs">
                      <span className={memberData.medical_details ? 'text-orange-700 font-medium' : 'text-gray-400'}>
                        {memberData.medical_details || 'None'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                    <div className="max-w-32 break-words text-xs">
                      <span className={memberData.dietary_requirements ? 'text-orange-700 font-medium' : 'text-gray-400'}>
                        {memberData.dietary_requirements || 'None'}
                      </span>
                    </div>
                  </td>
                  
                  {/* Consent Cells */}
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                      memberData.consent_photos === 'Yes' ? 'bg-green-100 text-green-800' : 
                        memberData.consent_photos === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                      {memberData.consent_photos || 'N/A'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                      memberData.consent_sensitive === 'Yes' ? 'bg-green-100 text-green-800' : 
                        memberData.consent_sensitive === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                      {memberData.consent_sensitive || 'N/A'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                      memberData.consent_paracetamol === 'Yes' ? 'bg-green-100 text-green-800' : 
                        memberData.consent_paracetamol === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                      {memberData.consent_paracetamol || 'N/A'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                      memberData.consent_ibuprofen === 'Yes' ? 'bg-green-100 text-green-800' : 
                        memberData.consent_ibuprofen === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                      {memberData.consent_ibuprofen || 'N/A'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center bg-green-25">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                      memberData.consent_suncream === 'Yes' ? 'bg-green-100 text-green-800' : 
                        memberData.consent_suncream === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                      {memberData.consent_suncream || 'N/A'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
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
