import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import { Button, Card, Input, Alert, Badge } from './ui';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import { isMobileLayout } from '../utils/platform.js';

function MembersList({ 
  sections, 
  members: propsMembers, 
  onBack,
  embedded = false,
  showHeader = true,
}) {
  const [members, setMembers] = useState(propsMembers || []);
  const [loading, setLoading] = useState(!propsMembers);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('lastname');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
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
    email: true,
    phone: true,
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

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const isMobile = isMobileLayout();
  const sectionIds = useMemo(
    () => sections.map((s) => s.sectionid),
    [sections],
  );
  const sectionIdsKey = sectionIds.join(',');

  const loadMembers = useCallback(async () => {
    if (!mountedRef.current) return;

    // Clear error state immediately so Retry hides error UI
    setError(null);
    setLoading(true);

    // Increment requestId to guard against race conditions
    const currentRequestId = ++requestIdRef.current;

    try {
      const token = getToken();
      const members = await getListOfMembers(sections, token);

      // Only apply state updates if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setMembers(members);
      }
    } catch (e) {
      // Only apply error state if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setError(e?.message ?? 'Unable to load members. Please try again.');
      }
    } finally {
      // Only turn off loading for the matching requestId so stale requests cannot override
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [sections]); // sections changes are captured directly

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (propsMembers) {
      // Cancel any in-flight async load and use provided data
      requestIdRef.current++;
      setMembers(propsMembers);
      setLoading(false);
      setError(null);
    } else {
      // Load members if not provided
      loadMembers();
    }
  }, [sectionIdsKey, propsMembers, loadMembers]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      return age;
    } catch {
      return '';
    }
  };

  // Helper function to group contact information (reused from MemberDetailModal)
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

  // Extract comprehensive member data from both flattened and nested formats
  const getComprehensiveData = (member) => {
    // Return empty object if no comprehensive data available
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

    return {
      // Basic info
      name: `${member.firstname} ${member.lastname}`,
      section: member.sectionname || '',
      patrol: member.patrol || '',
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
  };

  // Check if a column should be visible based on group settings
  const isColumnVisible = (column) => {
    if (!visibleColumns[column]) return false;
    
    // Basic columns
    if (['name', 'sections', 'email', 'phone', 'patrol', 'person_type', 'age'].includes(column)) {
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
    
    // Consents columns
    if (column.startsWith('consent_')) return visibleColumnGroups.consents;
    
    return false;
  };

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName =
        `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase();
      const email = (member.email || '').toLowerCase();
      const sectionsText = (member.sections || []).join(' ').toLowerCase();

      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        sectionsText.includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      // Special handling for specific fields
      if (sortField === 'name') {
        aValue = `${a.lastname || ''} ${a.firstname || ''}`;
        bValue = `${b.lastname || ''} ${b.firstname || ''}`;
      } else if (sortField === 'sections') {
        aValue = (a.sections || []).join(', ');
        bValue = (b.sections || []).join(', ');
      } else if (sortField === 'age') {
        aValue = calculateAge(a.date_of_birth);
        bValue = calculateAge(b.date_of_birth);
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [members, searchTerm, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    if (filteredAndSortedMembers.length === 0) {
      alert('No members to export');
      return;
    }

    // Define CSV headers based on available data
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Sections',
      'Patrol',
      'Person Type',
      'Age',
      'Date of Birth',
      'Address',
      'Postcode',
      'Emergency Contacts',
      'Medical Notes',
      'Dietary Requirements',
      'Active',
      'Started',
      'Joined',
    ];

    // Convert members to CSV rows using enhanced data
    const csvRows = [
      headers.join(','),
      ...filteredAndSortedMembers.map((member) => {
        const emergencyContacts = (member.emergency_contacts || [])
          .map((contact) =>
            `${contact.name} (${contact.phone}) ${contact.email}`.trim(),
          )
          .join('; ');

        return [
          `"${member.firstname || ''}"`,
          `"${member.lastname || ''}"`,
          `"${member.email || ''}"`,
          `"${member.phone || ''}"`,
          `"${(member.sections || []).join('; ')}"`,
          `"${member.patrol || ''}"`,
          `"${member.person_type || 'Young People'}"`,
          `"${calculateAge(member.date_of_birth)}"`,
          `"${member.date_of_birth || ''}"`,
          `"${member.address || ''}"`,
          `"${member.postcode || ''}"`,
          `"${emergencyContacts}"`,
          `"${member.medical_notes || ''}"`,
          `"${member.dietary_requirements || ''}"`,
          `"${member.active ? 'Yes' : 'No'}"`,
          `"${member.started || ''}"`,
          `"${member.joined || ''}"`,
        ].join(',');
      }),
    ];

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new globalThis.Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `members_${sectionIds.join('_')}_${new Date().toISOString().split('T')[0]}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-300">↕</span>;
    }
    return (
      <span className="text-scout-blue">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    console.log('✅ MembersList (WORKING) member structure:', {
      scoutid: member.scoutid,
      firstname: member.firstname,
      lastname: member.lastname,
      date_of_birth: member.date_of_birth,
      email: member.email,
      phone: member.phone,
      emergency_contacts: member.emergency_contacts,
      medical_notes: member.medical_notes,
      sections: member.sections,
      allKeys: Object.keys(member).sort(),
    });
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

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Members</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button variant="scout-blue" onClick={loadMembers} type="button">
            Retry
          </Button>
          <Button variant="outline" onClick={onBack} type="button">
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? '' : 'px-4 sm:px-6 lg:px-8'}>
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">
              Members ({filteredAndSortedMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Members from selected sections:{' '}
              {sections.map((s) => s.sectionname).join(', ')}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAndSortedMembers.length === 0}
              type="button"
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
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack} type="button">
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Column group filters for desktop */}
        {!isMobile && (
          <div className="space-y-3">
            {/* Column Group Toggles */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={visibleColumnGroups.basic ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, basic: !prev.basic }))}
                type="button"
              >
                📋 Basic Info
              </Button>
              <Button
                variant={visibleColumnGroups.primaryContact1 ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, primaryContact1: !prev.primaryContact1 }))}
                type="button"
              >
                👤 Primary Contact 1
              </Button>
              <Button
                variant={visibleColumnGroups.primaryContact2 ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, primaryContact2: !prev.primaryContact2 }))}
                type="button"
              >
                👥 Primary Contact 2
              </Button>
              <Button
                variant={visibleColumnGroups.emergencyContact ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, emergencyContact: !prev.emergencyContact }))}
                type="button"
              >
                🚨 Emergency Contact
              </Button>
              <Button
                variant={visibleColumnGroups.doctorSurgery ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, doctorSurgery: !prev.doctorSurgery }))}
                type="button"
              >
                🏥 Doctor&apos;s Surgery
              </Button>
              <Button
                variant={visibleColumnGroups.member ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, member: !prev.member }))}
                type="button"
              >
                🏠 Member Details
              </Button>
              <Button
                variant={visibleColumnGroups.additionalInfo ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, additionalInfo: !prev.additionalInfo }))}
                type="button"
              >
                ℹ️ Additional Info
              </Button>
              <Button
                variant={visibleColumnGroups.essentialInfo ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, essentialInfo: !prev.essentialInfo }))}
                type="button"
              >
                ⚠️ Essential Info
              </Button>
              <Button
                variant={visibleColumnGroups.consents ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumnGroups(prev => ({ ...prev, consents: !prev.consents }))}
                type="button"
              >
                ✅ Consents
              </Button>
            </div>
            
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6">
        {filteredAndSortedMembers.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search terms.'
                  : 'No members available for the selected sections.'}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4">
            {filteredAndSortedMembers.map((member) => (
              <Card
                key={member.scoutid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleMemberClick(member)}
              >
                <Card.Body>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {member.firstname} {member.lastname}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(member.sections || []).map((section, idx) => (
                          <Badge key={idx} variant="scout-blue" size="sm">
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="light">
                        Age {calculateAge(member.date_of_birth)}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        member.person_type === 'Leaders'
                          ? 'scout-purple'
                          : member.person_type === 'Young Leaders'
                            ? 'scout-blue'
                            : 'scout-green'
                      }
                      size="sm"
                    >
                      {member.person_type || 'Young People'}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    {member.email && (
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />

                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.patrol && (
                      <div className="flex items-center">
                        <span>Patrol: {member.patrol}</span>
                      </div>
                    )}

                    {/* Medical info */}
                    {member.medical_notes && (
                      <div className="flex items-center text-orange-600">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Medical info available
                      </div>
                    )}

                    {/* Emergency contacts */}
                    {member.emergency_contacts &&
                      member.emergency_contacts.length > 0 && (
                      <div className="text-xs text-gray-500">
                          Emergency contacts: {member.emergency_contacts.length}
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop: Table layout
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  {/* Group Headers Row */}
                  <tr className="border-b">
                    {/* Basic Info Group */}
                    {visibleColumnGroups.basic && (
                      <th
                        colSpan={
                          [isColumnVisible('name'), isColumnVisible('sections'), isColumnVisible('email'), isColumnVisible('phone'), isColumnVisible('patrol'), isColumnVisible('person_type'), isColumnVisible('age')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-scout-blue"
                      >
                        📋 Basic Info
                      </th>
                    )}
                    
                    {/* Primary Contact 1 Group */}
                    {visibleColumnGroups.primaryContact1 && (
                      <th
                        colSpan={
                          [isColumnVisible('pc1_name'), isColumnVisible('pc1_address'), isColumnVisible('pc1_phone'), isColumnVisible('pc1_email')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-scout-purple"
                      >
                        👤 Primary Contact 1
                      </th>
                    )}
                    
                    {/* Primary Contact 2 Group */}
                    {visibleColumnGroups.primaryContact2 && (
                      <th
                        colSpan={
                          [isColumnVisible('pc2_name'), isColumnVisible('pc2_address'), isColumnVisible('pc2_phone'), isColumnVisible('pc2_email')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-scout-forest-green"
                      >
                        👥 Primary Contact 2
                      </th>
                    )}
                    
                    {/* Emergency Contact Group */}
                    {visibleColumnGroups.emergencyContact && (
                      <th
                        colSpan={
                          [isColumnVisible('ec_name'), isColumnVisible('ec_address'), isColumnVisible('ec_phone'), isColumnVisible('ec_email')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-red-600"
                      >
                        🚨 Emergency Contact
                      </th>
                    )}
                    
                    {/* Doctor's Surgery Group */}
                    {visibleColumnGroups.doctorSurgery && (
                      <th
                        colSpan={
                          [isColumnVisible('doctor_name'), isColumnVisible('doctor_surgery'), isColumnVisible('doctor_address'), isColumnVisible('doctor_phone')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-green-600"
                      >
                        🏥 Doctor&apos;s Surgery
                      </th>
                    )}
                    
                    {/* Member Details Group */}
                    {visibleColumnGroups.member && (
                      <th
                        colSpan={
                          [isColumnVisible('member_address'), isColumnVisible('member_email'), isColumnVisible('member_phone')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-indigo-600"
                      >
                        🏠 Member Details
                      </th>
                    )}
                    
                    {/* Additional Info Group */}
                    {visibleColumnGroups.additionalInfo && (
                      <th
                        colSpan={
                          [isColumnVisible('school'), isColumnVisible('religion'), isColumnVisible('ethnicity'), isColumnVisible('gender')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-yellow-600"
                      >
                        ℹ️ Additional Info
                      </th>
                    )}
                    
                    {/* Essential Info Group */}
                    {visibleColumnGroups.essentialInfo && (
                      <th
                        colSpan={
                          [isColumnVisible('allergies'), isColumnVisible('medical_details'), isColumnVisible('dietary_requirements')].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-orange-600"
                      >
                        ⚠️ Essential Info
                      </th>
                    )}
                    
                    {/* Consents Group */}
                    {visibleColumnGroups.consents && (
                      <th
                        colSpan={
                          [
                            isColumnVisible('consent_photos'), 
                            isColumnVisible('consent_sensitive'),
                            isColumnVisible('consent_sharing'),
                            isColumnVisible('consent_paracetamol'),
                            isColumnVisible('consent_ibuprofen'),
                            isColumnVisible('consent_antihistamine'),
                            isColumnVisible('consent_antiseptics'),
                            isColumnVisible('consent_plasters'),
                            isColumnVisible('consent_bite_sting'),
                            isColumnVisible('consent_suncream'),
                            isColumnVisible('consent_aftersun'),
                            isColumnVisible('consent_insect_repellent'),
                          ].filter(Boolean).length
                        }
                        className="px-6 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-teal-600"
                      >
                        ✅ Consents
                      </th>
                    )}
                  </tr>
                  
                  {/* Individual Column Headers Row */}
                  <tr>
                    {/* Basic Info Columns */}
                    {isColumnVisible('name') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Name</span>
                          <SortIcon field="name" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('sections') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('sections')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Sections</span>
                          <SortIcon field="sections" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('email') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Email</span>
                          <SortIcon field="email" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('phone') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('phone')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Phone</span>
                          <SortIcon field="phone" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('patrol') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('patrol')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Patrol</span>
                          <SortIcon field="patrol" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('person_type') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('person_type')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Type</span>
                          <SortIcon field="person_type" />
                        </div>
                      </th>
                    )}
                    {isColumnVisible('age') && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('age')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Age</span>
                          <SortIcon field="age" />
                        </div>
                      </th>
                    )}
                    
                    {/* Primary Contact 1 Columns */}
                    {isColumnVisible('pc1_name') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                    )}
                    {isColumnVisible('pc1_address') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                    )}
                    {isColumnVisible('pc1_phone') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                    )}
                    {isColumnVisible('pc1_email') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    )}
                    
                    {/* Primary Contact 2 Columns */}
                    {isColumnVisible('pc2_name') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                    )}
                    {isColumnVisible('pc2_address') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                    )}
                    {isColumnVisible('pc2_phone') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                    )}
                    {isColumnVisible('pc2_email') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    )}
                    
                    {/* Emergency Contact Columns */}
                    {isColumnVisible('ec_name') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                    )}
                    {isColumnVisible('ec_address') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                    )}
                    {isColumnVisible('ec_phone') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                    )}
                    {isColumnVisible('ec_email') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    )}
                    
                    {/* Doctor's Surgery Columns */}
                    {isColumnVisible('doctor_name') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Doctor
                      </th>
                    )}
                    {isColumnVisible('doctor_surgery') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Surgery
                      </th>
                    )}
                    {isColumnVisible('doctor_address') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                    )}
                    {isColumnVisible('doctor_phone') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                    )}
                    
                    {/* Member Details Columns */}
                    {isColumnVisible('member_address') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                    )}
                    {isColumnVisible('member_email') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    )}
                    {isColumnVisible('member_phone') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                    )}
                    
                    {/* Additional Info Columns */}
                    {isColumnVisible('school') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        School
                      </th>
                    )}
                    {isColumnVisible('religion') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Religion
                      </th>
                    )}
                    {isColumnVisible('ethnicity') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ethnicity
                      </th>
                    )}
                    {isColumnVisible('gender') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gender
                      </th>
                    )}
                    
                    {/* Essential Info Columns */}
                    {isColumnVisible('allergies') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allergies
                      </th>
                    )}
                    {isColumnVisible('medical_details') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Medical
                      </th>
                    )}
                    {isColumnVisible('dietary_requirements') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dietary
                      </th>
                    )}
                    
                    {/* Consents Columns */}
                    {isColumnVisible('consent_photos') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Photos
                      </th>
                    )}
                    {isColumnVisible('consent_sensitive') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sensitive
                      </th>
                    )}
                    {isColumnVisible('consent_sharing') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sharing
                      </th>
                    )}
                    {isColumnVisible('consent_paracetamol') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paracetamol
                      </th>
                    )}
                    {isColumnVisible('consent_ibuprofen') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ibuprofen
                      </th>
                    )}
                    {isColumnVisible('consent_antihistamine') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Antihistamine
                      </th>
                    )}
                    {isColumnVisible('consent_antiseptics') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Antiseptics
                      </th>
                    )}
                    {isColumnVisible('consent_plasters') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plasters
                      </th>
                    )}
                    {isColumnVisible('consent_bite_sting') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bite Sting
                      </th>
                    )}
                    {isColumnVisible('consent_suncream') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Suncream
                      </th>
                    )}
                    {isColumnVisible('consent_aftersun') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aftersun
                      </th>
                    )}
                    {isColumnVisible('consent_insect_repellent') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Insect Rep
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedMembers.map((member) => {
                    const comprehensiveData = getComprehensiveData(member);
                    return (
                      <tr
                        key={member.scoutid}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleMemberClick(member)}
                      >
                        {/* Basic Info Columns */}
                        {isColumnVisible('name') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstname} {member.lastname}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('sections') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {(member.sections || []).map((section, idx) => (
                                <Badge key={idx} variant="scout-blue" size="sm">
                                  {section}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('email') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {member.email || '-'}
                          </td>
                        )}
                        {isColumnVisible('phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {member.phone || '-'}
                          </td>
                        )}
                        {isColumnVisible('patrol') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {member.patrol || '-'}
                          </td>
                        )}
                        {isColumnVisible('person_type') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <Badge
                              variant={
                                member.person_type === 'Leaders'
                                  ? 'scout-purple'
                                  : member.person_type === 'Young Leaders'
                                    ? 'scout-blue'
                                    : 'scout-green'
                              }
                              size="sm"
                            >
                              {member.person_type || 'Young People'}
                            </Badge>
                          </td>
                        )}
                        {isColumnVisible('age') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {calculateAge(member.date_of_birth) || '-'}
                          </td>
                        )}
                        
                        {/* Primary Contact 1 Columns */}
                        {isColumnVisible('pc1_name') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.pc1_name || '-'}
                          </td>
                        )}
                        {isColumnVisible('pc1_address') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.pc1_address}>
                              {comprehensiveData.pc1_address || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('pc1_phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.pc1_phone || '-'}
                          </td>
                        )}
                        {isColumnVisible('pc1_email') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.pc1_email}>
                              {comprehensiveData.pc1_email || '-'}
                            </div>
                          </td>
                        )}
                        
                        {/* Primary Contact 2 Columns */}
                        {isColumnVisible('pc2_name') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.pc2_name || '-'}
                          </td>
                        )}
                        {isColumnVisible('pc2_address') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.pc2_address}>
                              {comprehensiveData.pc2_address || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('pc2_phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.pc2_phone || '-'}
                          </td>
                        )}
                        {isColumnVisible('pc2_email') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.pc2_email}>
                              {comprehensiveData.pc2_email || '-'}
                            </div>
                          </td>
                        )}
                        
                        {/* Emergency Contact Columns */}
                        {isColumnVisible('ec_name') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.ec_name || '-'}
                          </td>
                        )}
                        {isColumnVisible('ec_address') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.ec_address}>
                              {comprehensiveData.ec_address || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('ec_phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.ec_phone || '-'}
                          </td>
                        )}
                        {isColumnVisible('ec_email') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.ec_email}>
                              {comprehensiveData.ec_email || '-'}
                            </div>
                          </td>
                        )}
                        
                        {/* Doctor's Surgery Columns */}
                        {isColumnVisible('doctor_name') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.doctor_name || '-'}
                          </td>
                        )}
                        {isColumnVisible('doctor_surgery') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.doctor_surgery || '-'}
                          </td>
                        )}
                        {isColumnVisible('doctor_address') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.doctor_address}>
                              {comprehensiveData.doctor_address || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('doctor_phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.doctor_phone || '-'}
                          </td>
                        )}
                        
                        {/* Member Details Columns */}
                        {isColumnVisible('member_address') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.member_address}>
                              {comprehensiveData.member_address || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('member_email') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.member_email}>
                              {comprehensiveData.member_email || '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('member_phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.member_phone || '-'}
                          </td>
                        )}
                        
                        {/* Additional Info Columns */}
                        {isColumnVisible('school') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.school || '-'}
                          </td>
                        )}
                        {isColumnVisible('religion') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.religion || '-'}
                          </td>
                        )}
                        {isColumnVisible('ethnicity') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.ethnicity || '-'}
                          </td>
                        )}
                        {isColumnVisible('gender') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.gender || '-'}
                          </td>
                        )}
                        
                        {/* Essential Info Columns */}
                        {isColumnVisible('allergies') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.allergies}>
                              {comprehensiveData.allergies ? (
                                <span className={comprehensiveData.allergies.toLowerCase().includes('none') ? 'text-green-600' : 'text-orange-600'}>
                                  {comprehensiveData.allergies}
                                </span>
                              ) : '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('medical_details') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.medical_details}>
                              {comprehensiveData.medical_details ? (
                                <span className="text-orange-600">{comprehensiveData.medical_details}</span>
                              ) : '-'}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('dietary_requirements') && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={comprehensiveData.dietary_requirements}>
                              {comprehensiveData.dietary_requirements || '-'}
                            </div>
                          </td>
                        )}
                        
                        {/* Consents Columns */}
                        {isColumnVisible('consent_photos') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_photos ? (
                              <Badge
                                variant={comprehensiveData.consent_photos.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_photos}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_sensitive') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_sensitive ? (
                              <Badge
                                variant={comprehensiveData.consent_sensitive.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_sensitive}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_sharing') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_sharing ? (
                              <Badge
                                variant={comprehensiveData.consent_sharing.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_sharing}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        
                        {/* Medical Treatment Consent Columns */}
                        {isColumnVisible('consent_paracetamol') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_paracetamol ? (
                              <Badge
                                variant={comprehensiveData.consent_paracetamol.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_paracetamol}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_ibuprofen') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_ibuprofen ? (
                              <Badge
                                variant={comprehensiveData.consent_ibuprofen.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_ibuprofen}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_antihistamine') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_antihistamine ? (
                              <Badge
                                variant={comprehensiveData.consent_antihistamine.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_antihistamine}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_antiseptics') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_antiseptics ? (
                              <Badge
                                variant={comprehensiveData.consent_antiseptics.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_antiseptics}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_plasters') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_plasters ? (
                              <Badge
                                variant={comprehensiveData.consent_plasters.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_plasters}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_bite_sting') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_bite_sting ? (
                              <Badge
                                variant={comprehensiveData.consent_bite_sting.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_bite_sting}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_suncream') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_suncream ? (
                              <Badge
                                variant={comprehensiveData.consent_suncream.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_suncream}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_aftersun') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_aftersun ? (
                              <Badge
                                variant={comprehensiveData.consent_aftersun.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_aftersun}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                        {isColumnVisible('consent_insect_repellent') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {comprehensiveData.consent_insect_repellent ? (
                              <Badge
                                variant={comprehensiveData.consent_insect_repellent.toLowerCase() === 'yes' ? 'scout-green' : 'scout-red'}
                                size="sm"
                              >
                                {comprehensiveData.consent_insect_repellent}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
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

export default MembersList;
