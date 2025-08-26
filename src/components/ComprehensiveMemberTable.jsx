import React, { useState } from 'react';
import { Button } from './ui';

// Helper function to group contact information (reused across components)
const groupContactInfo = (member) => {
  const groups = {};

  // Process flattened contact fields
  Object.entries(member).forEach(([key, value]) => {
    if (key.includes('__') && value !== undefined && value !== null) {
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
          if (fieldValue !== undefined && fieldValue !== null) {
            const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            groups[normalizedGroupName][normalizedFieldName] = fieldValue;
          }
        });
      }
    });
  }

  return groups;
};

// Extract comprehensive member data for table display
const getComprehensiveData = (member, extraDataExtractor = null) => {
  if (!member || typeof member !== 'object') return {};

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
  const combineFields = (groupNames, fieldNames) => {
    const values = [];
    for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
      const group = contactGroups[groupName];
      if (group) {
        for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
          if (group[fieldName]) values.push(group[fieldName]);
        }
      }
    }
    return values.join(', ');
  };

  const baseData = {
    // Basic info
    name: `${member.firstname || member.first_name} ${member.lastname || member.last_name}`,
    section: member.sectionname || '',
    patrol: member.patrol || '',
    person_type: member.person_type || 'Young People',
    age: member.date_of_birth ? Math.floor((Date.now() - new Date(member.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '',
    
    // Primary Contact 1 (check both flattened and nested)
    pc1_name: combineFields(['primary_contact_1'], ['first_name', 'last_name']) || 
              [member.primary_contact_1__first_name, member.primary_contact_1__last_name].filter(Boolean).join(' ') || '',
    pc1_address: combineFields(['primary_contact_1'], ['address_1', 'address_2', 'address_3']) || 
                 [member.primary_contact_1__address_1, member.primary_contact_1__address_2, member.primary_contact_1__address_3].filter(Boolean).join(', ') || '',
    pc1_phone: combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || 
               [member.primary_contact_1__phone_1, member.primary_contact_1__phone_2].filter(Boolean).join(', ') || '',
    pc1_email: combineFields(['primary_contact_1'], ['email_1', 'email_2']) || 
               [member.primary_contact_1__email_1, member.primary_contact_1__email_2].filter(Boolean).join(', ') || '',
    
    // Primary Contact 2 (check both flattened and nested)
    pc2_name: combineFields(['primary_contact_2'], ['first_name', 'last_name']) || 
              [member.primary_contact_2__first_name, member.primary_contact_2__last_name].filter(Boolean).join(' ') || '',
    pc2_address: combineFields(['primary_contact_2'], ['address_1', 'address_2', 'address_3']) || 
                 [member.primary_contact_2__address_1, member.primary_contact_2__address_2, member.primary_contact_2__address_3].filter(Boolean).join(', ') || '',
    pc2_phone: combineFields(['primary_contact_2'], ['phone_1', 'phone_2']) || 
               [member.primary_contact_2__phone_1, member.primary_contact_2__phone_2].filter(Boolean).join(', ') || '',
    pc2_email: combineFields(['primary_contact_2'], ['email_1', 'email_2']) || 
               [member.primary_contact_2__email_1, member.primary_contact_2__email_2].filter(Boolean).join(', ') || '',
    
    // Emergency Contact (check both flattened and nested)
    ec_name: combineFields(['emergency_contact'], ['first_name', 'last_name']) || 
             [member.emergency_contact__first_name, member.emergency_contact__last_name].filter(Boolean).join(' ') || '',
    ec_address: combineFields(['emergency_contact'], ['address_1', 'address_2', 'address_3']) || 
                [member.emergency_contact__address_1, member.emergency_contact__address_2, member.emergency_contact__address_3].filter(Boolean).join(', ') || '',
    ec_phone: combineFields(['emergency_contact'], ['phone_1', 'phone_2']) || 
              [member.emergency_contact__phone_1, member.emergency_contact__phone_2].filter(Boolean).join(', ') || '',
    ec_email: combineFields(['emergency_contact'], ['email_1', 'email_2']) || 
              [member.emergency_contact__email_1, member.emergency_contact__email_2].filter(Boolean).join(', ') || '',
    
    // Doctor's Surgery (check both flattened and nested) 
    doctor_name: getField(['doctor_s_surgery', 'doctors_surgery'], ['first_name']) || member.doctor_s_surgery__first_name || '',
    doctor_surgery: getField(['doctor_s_surgery', 'doctors_surgery'], ['surgery']) || member.doctor_s_surgery__surgery || '',
    doctor_address: combineFields(['doctor_s_surgery', 'doctors_surgery'], ['address_1', 'address_2', 'address_3']) || 
                    [member.doctor_s_surgery__address_1, member.doctor_s_surgery__address_2, member.doctor_s_surgery__address_3].filter(Boolean).join(', ') || '',
    doctor_phone: getField(['doctor_s_surgery', 'doctors_surgery'], ['phone_1']) || member.doctor_s_surgery__phone_1 || '',
    
    // Member Details (check both flattened and nested)
    member_address: combineFields(['member'], ['address_1', 'address_2', 'address_3', 'address_4']) || 
                    [member.member__address_1, member.member__address_2, member.member__address_3, member.member__address_4].filter(Boolean).join(', ') || '',
    member_email: combineFields(['member'], ['email_1', 'email_2']) || 
                  [member.member__email_1, member.member__email_2].filter(Boolean).join(', ') || '',
    member_phone: combineFields(['member'], ['phone_1', 'phone_2']) || 
                  [member.member__phone_1, member.member__phone_2].filter(Boolean).join(', ') || '',
    
    // Additional Information (check both flattened and nested)
    school: getField(['additional_information'], ['school']) || member.additional_information__school || '',
    religion: getField(['additional_information'], ['religion']) || member.additional_information__religion || '',
    ethnicity: getField(['additional_information'], ['ethnicity']) || member.additional_information__ethnicity || '',
    gender: getField(['other'], ['gender']) || member.other__gender || '',
    
    // Essential Information (check both flattened and nested)
    allergies: getField(['essential_information'], ['allergies']) || member.essential_information__allergies || '',
    medical_details: getField(['essential_information'], ['medical_details']) || member.essential_information__medical_details || '',
    dietary_requirements: getField(['essential_information'], ['dietary_requirements']) || member.essential_information__dietary_requirements || '',
    
    // Consents - General (check nested contact_groups.Consents first, then flattened)
    consent_photos: getField(['consents'], ['photographs', 'photos']) || member.consents__photographs || '',
    consent_sensitive: getField(['consents'], ['sensitive_information']) || member.consents__sensitive_information || '',
    consent_sharing: getField(['consents'], ['sharing_contact_details']) || member.consents__sharing_contact_details || '',
    
    // Consents - Medical Treatment (check nested contact_groups.Consents first, then flattened)
    consent_paracetamol: getField(['consents'], ['paracetamol']) || member.consents__paracetamol || '',
    consent_ibuprofen: getField(['consents'], ['ibuprofen']) || member.consents__ibuprofen || '',
    consent_antihistamine: getField(['consents'], ['antihistamine']) || member.consents__antihistamine || '',
    consent_antiseptics: getField(['consents'], ['antiseptics']) || member.consents__antiseptics || '',
    consent_plasters: getField(['consents'], ['plasters']) || member.consents__plasters || '',
    consent_bite_sting: getField(['consents'], ['bite_sting_relief', 'bite_sting']) || member.consents__bite_sting_relief || '',
    consent_suncream: getField(['consents'], ['suncream', 'sun_cream']) || member.consents__suncream || '',
    consent_aftersun: getField(['consents'], ['aftersun', 'after_sun']) || member.consents__aftersun || '',
    consent_insect_repellent: getField(['consents'], ['insect_repellent']) || member.consents__insect_repellent || '',
  };

  // Allow extra data extraction (e.g., for attendance status)
  return extraDataExtractor ? { ...baseData, ...extraDataExtractor(member) } : baseData;
};

function ComprehensiveMemberTable({ 
  members, 
  onMemberClick, 
  extraColumns = [], 
  extraDataExtractor = null,
  showFilters = true,
  className = '',
}) {
  // Column group visibility state
  const [visibleColumnGroups, setVisibleColumnGroups] = useState({
    basic: true,
    primaryContact1: false,
    primaryContact2: false,
    emergencyContact: false,
    doctorSurgery: false,
    member: false,
    additionalInfo: false,
    essentialInfo: false,
    consents: false,
  });

  // Individual column visibility (within visible groups)
  const [visibleColumns] = useState({
    // Basic Info
    name: true,
    sections: true,
    patrol: true,
    person_type: true,
    age: true,
    // Primary Contact 1
    pc1_name: true,
    pc1_address: true,
    pc1_phone: true,
    pc1_email: true,
    // Primary Contact 2  
    pc2_name: true,
    pc2_address: true,
    pc2_phone: true,
    pc2_email: true,
    // Emergency Contact
    ec_name: true,
    ec_address: true,
    ec_phone: true,
    ec_email: true,
    // Doctor's Surgery
    doctor_name: true,
    doctor_surgery: true,
    doctor_address: true,
    doctor_phone: true,
    // Member Details
    member_address: true,
    member_email: true,
    member_phone: true,
    // Additional Information
    school: true,
    religion: true,
    ethnicity: true,
    gender: true,
    // Essential Information
    allergies: true,
    medical_details: true,
    dietary_requirements: true,
    // Consents - General
    consent_photos: true,
    consent_sensitive: true,
    consent_sharing: true,
    // Consents - Medical Treatment
    consent_paracetamol: true,
    consent_ibuprofen: true,
    consent_antihistamine: true,
    consent_antiseptics: true,
    consent_plasters: true,
    consent_bite_sting: true,
    consent_suncream: true,
    consent_aftersun: true,
    consent_insect_repellent: true,
  });

  // Check if a column should be visible based on group settings
  const isColumnVisible = (column) => {
    if (!visibleColumns[column]) return false;
    
    // Basic columns
    if (['name', 'sections', 'patrol', 'person_type', 'age'].includes(column)) {
      return visibleColumnGroups.basic;
    }
    
    // Primary Contact 1 columns
    if (column.startsWith('pc1_')) return visibleColumnGroups.primaryContact1;
    
    // Primary Contact 2 columns  
    if (column.startsWith('pc2_')) return visibleColumnGroups.primaryContact2;
    
    // Emergency Contact columns
    if (column.startsWith('ec_')) return visibleColumnGroups.emergencyContact;
    
    // Doctor's Surgery columns
    if (column.startsWith('doctor_')) return visibleColumnGroups.doctorSurgery;
    
    // Member Details columns
    if (column.startsWith('member_')) return visibleColumnGroups.member;
    
    // Additional Information columns
    if (['school', 'religion', 'ethnicity', 'gender'].includes(column)) {
      return visibleColumnGroups.additionalInfo;
    }
    
    // Essential Information columns
    if (['allergies', 'medical_details', 'dietary_requirements'].includes(column)) {
      return visibleColumnGroups.essentialInfo;
    }
    
    // Consent columns
    if (column.startsWith('consent_')) return visibleColumnGroups.consents;
    
    return false;
  };

  // Handle column group toggle
  const toggleColumnGroup = (group) => {
    setVisibleColumnGroups(prev => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <div className={className}>
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={visibleColumnGroups.basic ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('basic')}
            type="button"
          >
            📋 Basic Info
          </Button>
          <Button
            variant={visibleColumnGroups.primaryContact1 ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('primaryContact1')}
            type="button"
          >
            👤 Primary Contact 1
          </Button>
          <Button
            variant={visibleColumnGroups.primaryContact2 ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('primaryContact2')}
            type="button"
          >
            👥 Primary Contact 2
          </Button>
          <Button
            variant={visibleColumnGroups.emergencyContact ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('emergencyContact')}
            type="button"
          >
            🚨 Emergency Contact
          </Button>
          <Button
            variant={visibleColumnGroups.doctorSurgery ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('doctorSurgery')}
            type="button"
          >
            🏥 Doctor&apos;s Surgery
          </Button>
          <Button
            variant={visibleColumnGroups.member ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('member')}
            type="button"
          >
            🏠 Member Details
          </Button>
          <Button
            variant={visibleColumnGroups.additionalInfo ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('additionalInfo')}
            type="button"
          >
            ℹ️ Additional Info
          </Button>
          <Button
            variant={visibleColumnGroups.essentialInfo ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('essentialInfo')}
            type="button"
          >
            🩺 Essential Info
          </Button>
          <Button
            variant={visibleColumnGroups.consents ? 'scout-blue' : 'outline'}
            size="sm"
            onClick={() => toggleColumnGroup('consents')}
            type="button"
          >
            ✅ Consents
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Two-tier Header */}
          <thead className="bg-gray-50">
            {/* Group Headers */}
            <tr className="bg-gray-100">
              {/* Basic Info Group */}
              {visibleColumnGroups.basic && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300" colSpan="5">
                  📋 Basic Information
                </th>
              )}
              
              {/* Primary Contact 1 Group */}
              {visibleColumnGroups.primaryContact1 && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-blue-100" colSpan="4">
                  👤 Primary Contact 1
                </th>
              )}
              
              {/* Primary Contact 2 Group */}
              {visibleColumnGroups.primaryContact2 && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-indigo-100" colSpan="4">
                  👥 Primary Contact 2
                </th>
              )}
              
              {/* Emergency Contact Group */}
              {visibleColumnGroups.emergencyContact && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-red-100" colSpan="4">
                  🚨 Emergency Contact
                </th>
              )}
              
              {/* Doctor's Surgery Group */}
              {visibleColumnGroups.doctorSurgery && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-green-100" colSpan="4">
                  🏥 Doctor&apos;s Surgery
                </th>
              )}
              
              {/* Member Details Group */}
              {visibleColumnGroups.member && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-purple-100" colSpan="3">
                  🏠 Member Details
                </th>
              )}
              
              {/* Additional Information Group */}
              {visibleColumnGroups.additionalInfo && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-scout-yellow/20" colSpan="4">
                  ℹ️ Additional Information
                </th>
              )}
              
              {/* Essential Information Group */}
              {visibleColumnGroups.essentialInfo && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 border-r border-gray-300 bg-orange-100" colSpan="3">
                  🩺 Essential Information
                </th>
              )}
              
              {/* Consents Group */}
              {visibleColumnGroups.consents && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-100" colSpan="12">
                  ✅ Consents
                </th>
              )}

              {/* Extra Column Groups */}
              {extraColumns.map((col, idx) => (
                <th key={idx} className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">
                  {col.groupTitle}
                </th>
              ))}
            </tr>
            
            {/* Column Headers */}
            <tr>
              {/* Basic Info Columns */}
              {visibleColumnGroups.basic && isColumnVisible('name') && (
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">Name</th>
              )}
              {visibleColumnGroups.basic && (
                <>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">Section</th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">Patrol</th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">Type</th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2">Age</th>
                </>
              )}

              {/* Primary Contact 1 Columns */}
              {visibleColumnGroups.primaryContact1 && (
                <>
                  {isColumnVisible('pc1_name') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-blue-50">Name</th>}
                  {isColumnVisible('pc1_address') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-blue-50">Address</th>}
                  {isColumnVisible('pc1_phone') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-blue-50">Phone</th>}
                  {isColumnVisible('pc1_email') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-blue-50">Email</th>}
                </>
              )}

              {/* Primary Contact 2 Columns */}
              {visibleColumnGroups.primaryContact2 && (
                <>
                  {isColumnVisible('pc2_name') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-indigo-50">Name</th>}
                  {isColumnVisible('pc2_address') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-indigo-50">Address</th>}
                  {isColumnVisible('pc2_phone') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-indigo-50">Phone</th>}
                  {isColumnVisible('pc2_email') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-indigo-50">Email</th>}
                </>
              )}

              {/* Emergency Contact Columns */}
              {visibleColumnGroups.emergencyContact && (
                <>
                  {isColumnVisible('ec_name') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-red-50">Name</th>}
                  {isColumnVisible('ec_address') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-red-50">Address</th>}
                  {isColumnVisible('ec_phone') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-red-50">Phone</th>}
                  {isColumnVisible('ec_email') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-red-50">Email</th>}
                </>
              )}

              {/* Doctor's Surgery Columns */}
              {visibleColumnGroups.doctorSurgery && (
                <>
                  {isColumnVisible('doctor_name') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-green-50">Doctor</th>}
                  {isColumnVisible('doctor_surgery') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-green-50">Surgery</th>}
                  {isColumnVisible('doctor_address') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-green-50">Address</th>}
                  {isColumnVisible('doctor_phone') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-green-50">Phone</th>}
                </>
              )}

              {/* Member Details Columns */}
              {visibleColumnGroups.member && (
                <>
                  {isColumnVisible('member_address') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-purple-50">Address</th>}
                  {isColumnVisible('member_email') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-purple-50">Email</th>}
                  {isColumnVisible('member_phone') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-purple-50">Phone</th>}
                </>
              )}

              {/* Additional Information Columns */}
              {visibleColumnGroups.additionalInfo && (
                <>
                  {isColumnVisible('school') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-scout-yellow/10">School</th>}
                  {isColumnVisible('religion') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-scout-yellow/10">Religion</th>}
                  {isColumnVisible('ethnicity') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-scout-yellow/10">Ethnicity</th>}
                  {isColumnVisible('gender') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-scout-yellow/10">Gender</th>}
                </>
              )}

              {/* Essential Information Columns */}
              {visibleColumnGroups.essentialInfo && (
                <>
                  {isColumnVisible('allergies') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-orange-50">Allergies</th>}
                  {isColumnVisible('medical_details') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-orange-50">Medical</th>}
                  {isColumnVisible('dietary_requirements') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-orange-50">Dietary</th>}
                </>
              )}

              {/* Consent Columns */}
              {visibleColumnGroups.consents && (
                <>
                  {isColumnVisible('consent_photos') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Photos</th>}
                  {isColumnVisible('consent_sensitive') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Sensitive</th>}
                  {isColumnVisible('consent_sharing') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Sharing</th>}
                  {isColumnVisible('consent_paracetamol') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Paracetamol</th>}
                  {isColumnVisible('consent_ibuprofen') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Ibuprofen</th>}
                  {isColumnVisible('consent_antihistamine') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Antihistamine</th>}
                  {isColumnVisible('consent_antiseptics') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Antiseptics</th>}
                  {isColumnVisible('consent_plasters') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Plasters</th>}
                  {isColumnVisible('consent_bite_sting') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Bite/Sting</th>}
                  {isColumnVisible('consent_suncream') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Suncream</th>}
                  {isColumnVisible('consent_aftersun') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Aftersun</th>}
                  {isColumnVisible('consent_insect_repellent') && <th className="text-xs font-medium text-gray-500 uppercase tracking-wider p-2 bg-emerald-50">Insect Rep.</th>}
                </>
              )}

              {/* Extra Columns */}
              {extraColumns.map((col, idx) => (
                <th key={idx} className={`text-xs font-medium text-gray-500 uppercase tracking-wider p-2 ${col.headerClass || ''}`}>
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member, index) => {
              const memberData = getComprehensiveData(member, extraDataExtractor);
              
              return (
                <tr key={index} className="hover:bg-gray-50 text-xs">
                  {/* Basic Info Cells */}
                  {visibleColumnGroups.basic && isColumnVisible('name') && (
                    <td className="p-2 whitespace-nowrap">
                      <button
                        onClick={() => onMemberClick?.(member)}
                        className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                      >
                        {memberData.name}
                      </button>
                    </td>
                  )}
                  {visibleColumnGroups.basic && (
                    <>
                      <td className="p-2 whitespace-nowrap text-gray-900">{memberData.section}</td>
                      <td className="p-2 whitespace-nowrap text-gray-900">{memberData.patrol}</td>
                      <td className="p-2 whitespace-nowrap text-gray-900">{memberData.person_type}</td>
                      <td className="p-2 whitespace-nowrap text-gray-900">{memberData.age}</td>
                    </>
                  )}

                  {/* Primary Contact 1 Cells */}
                  {visibleColumnGroups.primaryContact1 && (
                    <>
                      {isColumnVisible('pc1_name') && <td className="p-2 whitespace-nowrap text-gray-900 bg-blue-25">{memberData.pc1_name}</td>}
                      {isColumnVisible('pc1_address') && <td className="p-2 whitespace-nowrap text-gray-900 bg-blue-25">{memberData.pc1_address}</td>}
                      {isColumnVisible('pc1_phone') && <td className="p-2 whitespace-nowrap text-gray-900 bg-blue-25">{memberData.pc1_phone}</td>}
                      {isColumnVisible('pc1_email') && <td className="p-2 whitespace-nowrap text-gray-900 bg-blue-25">{memberData.pc1_email}</td>}
                    </>
                  )}

                  {/* Primary Contact 2 Cells */}
                  {visibleColumnGroups.primaryContact2 && (
                    <>
                      {isColumnVisible('pc2_name') && <td className="p-2 whitespace-nowrap text-gray-900 bg-indigo-25">{memberData.pc2_name}</td>}
                      {isColumnVisible('pc2_address') && <td className="p-2 whitespace-nowrap text-gray-900 bg-indigo-25">{memberData.pc2_address}</td>}
                      {isColumnVisible('pc2_phone') && <td className="p-2 whitespace-nowrap text-gray-900 bg-indigo-25">{memberData.pc2_phone}</td>}
                      {isColumnVisible('pc2_email') && <td className="p-2 whitespace-nowrap text-gray-900 bg-indigo-25">{memberData.pc2_email}</td>}
                    </>
                  )}

                  {/* Emergency Contact Cells */}
                  {visibleColumnGroups.emergencyContact && (
                    <>
                      {isColumnVisible('ec_name') && <td className="p-2 whitespace-nowrap text-gray-900 bg-red-25">{memberData.ec_name}</td>}
                      {isColumnVisible('ec_address') && <td className="p-2 whitespace-nowrap text-gray-900 bg-red-25">{memberData.ec_address}</td>}
                      {isColumnVisible('ec_phone') && <td className="p-2 whitespace-nowrap text-gray-900 bg-red-25">{memberData.ec_phone}</td>}
                      {isColumnVisible('ec_email') && <td className="p-2 whitespace-nowrap text-gray-900 bg-red-25">{memberData.ec_email}</td>}
                    </>
                  )}

                  {/* Doctor's Surgery Cells */}
                  {visibleColumnGroups.doctorSurgery && (
                    <>
                      {isColumnVisible('doctor_name') && <td className="p-2 whitespace-nowrap text-gray-900 bg-green-25">{memberData.doctor_name}</td>}
                      {isColumnVisible('doctor_surgery') && <td className="p-2 whitespace-nowrap text-gray-900 bg-green-25">{memberData.doctor_surgery}</td>}
                      {isColumnVisible('doctor_address') && <td className="p-2 whitespace-nowrap text-gray-900 bg-green-25">{memberData.doctor_address}</td>}
                      {isColumnVisible('doctor_phone') && <td className="p-2 whitespace-nowrap text-gray-900 bg-green-25">{memberData.doctor_phone}</td>}
                    </>
                  )}

                  {/* Member Details Cells */}
                  {visibleColumnGroups.member && (
                    <>
                      {isColumnVisible('member_address') && <td className="p-2 whitespace-nowrap text-gray-900 bg-purple-25">{memberData.member_address}</td>}
                      {isColumnVisible('member_email') && <td className="p-2 whitespace-nowrap text-gray-900 bg-purple-25">{memberData.member_email}</td>}
                      {isColumnVisible('member_phone') && <td className="p-2 whitespace-nowrap text-gray-900 bg-purple-25">{memberData.member_phone}</td>}
                    </>
                  )}

                  {/* Additional Information Cells */}
                  {visibleColumnGroups.additionalInfo && (
                    <>
                      {isColumnVisible('school') && <td className="p-2 whitespace-nowrap text-gray-900 bg-scout-yellow/5">{memberData.school}</td>}
                      {isColumnVisible('religion') && <td className="p-2 whitespace-nowrap text-gray-900 bg-scout-yellow/5">{memberData.religion}</td>}
                      {isColumnVisible('ethnicity') && <td className="p-2 whitespace-nowrap text-gray-900 bg-scout-yellow/5">{memberData.ethnicity}</td>}
                      {isColumnVisible('gender') && <td className="p-2 whitespace-nowrap text-gray-900 bg-scout-yellow/5">{memberData.gender}</td>}
                    </>
                  )}

                  {/* Essential Information Cells */}
                  {visibleColumnGroups.essentialInfo && (
                    <>
                      {isColumnVisible('allergies') && (
                        <td className="p-2 whitespace-nowrap text-gray-900 bg-orange-25">
                          <span className={memberData.allergies ? 'text-orange-700 font-medium' : 'text-gray-400'}>
                            {memberData.allergies || 'None'}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('medical_details') && (
                        <td className="p-2 whitespace-nowrap text-gray-900 bg-orange-25">
                          <span className={memberData.medical_details ? 'text-orange-700' : 'text-gray-400'}>
                            {memberData.medical_details || 'None'}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('dietary_requirements') && (
                        <td className="p-2 whitespace-nowrap text-gray-900 bg-orange-25">
                          <span className={memberData.dietary_requirements ? 'text-orange-700' : 'text-gray-400'}>
                            {memberData.dietary_requirements || 'None'}
                          </span>
                        </td>
                      )}
                    </>
                  )}

                  {/* Consent Cells */}
                  {visibleColumnGroups.consents && (
                    <>
                      {[
                        'consent_photos', 'consent_sensitive', 'consent_sharing',
                        'consent_paracetamol', 'consent_ibuprofen', 'consent_antihistamine',
                        'consent_antiseptics', 'consent_plasters', 'consent_bite_sting',
                        'consent_suncream', 'consent_aftersun', 'consent_insect_repellent',
                      ].map(consentField => {
                        // Normalize consent value to handle booleans and variants
                        const normalizeConsent = (value) => {
                          if (value === true || value === 'true' || value === 'Y' || value === 'yes' || value === 'Yes') {
                            return 'Yes';
                          } else if (value === false || value === 'false' || value === 'N' || value === 'no' || value === 'No') {
                            return 'No';
                          }
                          return 'N/A';
                        };
                        
                        const normalized = normalizeConsent(memberData[consentField]);
                        
                        return isColumnVisible(consentField) && (
                          <td key={consentField} className="p-2 whitespace-nowrap text-center bg-emerald-25">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${
                              normalized === 'Yes' ? 'bg-green-100 text-green-800' : 
                                normalized === 'No' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                            }`}>
                              {normalized}
                            </span>
                          </td>
                        );
                      })}
                    </>
                  )}

                  {/* Extra Columns */}
                  {extraColumns.map((col, idx) => (
                    <td key={idx} className={`p-2 whitespace-nowrap ${col.cellClass || ''}`}>
                      {col.render ? col.render(memberData, member) : memberData[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComprehensiveMemberTable;