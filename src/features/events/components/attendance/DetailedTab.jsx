import React, { useState } from 'react';
import { MedicalDataPill } from '../../../../shared/components/ui';
// import { formatMedicalDataForDisplay } from '../../../../shared/utils/medicalDataUtils.js';
import { calculateAge } from '../../../../shared/utils/ageUtils.js';
import { groupContactInfo } from '../../../../shared/utils/contactGroups.js';

function DetailedTab({ summaryStats, members, onMemberClick, showContacts = false }) {
  const [_selectedMember, _setSelectedMember] = useState(null);
  const [_showMemberModal, _setShowMemberModal] = useState(false);

  if (!summaryStats || !Array.isArray(summaryStats) || summaryStats.length === 0) {
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

  // Get comprehensive member data (same as SectionsList)
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
      age: calculateAge(member.date_of_birth),
      
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
      
      // Essential Information (comprehensive approach)
      essential_information: contactGroups.essential_information || {},
      allergies: contactGroups.essential_information?.allergies || '',
      medical_details: contactGroups.essential_information?.medical_details || '',
      dietary_requirements: contactGroups.essential_information?.dietary_requirements || '',
      tetanus_year_of_last_jab: contactGroups.essential_information?.tetanus_year_of_last_jab || '',
      swimmer: contactGroups.essential_information?.swimmer || '',
      other_useful_information: contactGroups.essential_information?.other_useful_information || '',
      confirmed_by_parents: contactGroups.essential_information?.confirmed_by_parents || '',
      
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
    onMemberClick(member);
  };

  // Get attendance status for a member (use summaryStats which has attendance info)
  const getMemberAttendanceStatus = (attendee) => {
    // The attendee object from summaryStats already contains attendance counts
    // Determine primary status based on counts (similar to filter logic)
    if (attendee.yes > 0) return 'Yes';
    if (attendee.no > 0) return 'No';
    if (attendee.invited > 0) return 'Invited';
    if (attendee.notInvited > 0) return 'Not Invited';
    
    return 'Unknown';
  };

  // Get Viking Event data for an attendee
  const getMemberVikingEventData = (attendee) => {
    // The attendee object from summaryStats already contains vikingEventData
    return attendee?.vikingEventData || null;
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Basic Info Headers */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                Member
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50">
                Event Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50">
                Camp Group
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
            {summaryStats.map((attendee, index) => {
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
                    {memberData.section}
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
    </div>
  );
}

export default DetailedTab;