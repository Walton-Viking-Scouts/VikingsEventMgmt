import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import CompactAttendanceFilter from './CompactAttendanceFilter.jsx';
import SectionFilter from './SectionFilter.jsx';
import CampGroupsView from './CampGroupsView.jsx';
import SignInOutButton from './SignInOutButton.jsx';
import ComprehensiveMemberTable from './ComprehensiveMemberTable.jsx';
import { Card, Button, Badge, Alert } from './ui';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import { useSignInOut } from '../hooks/useSignInOut.js';
import { findMemberSectionName } from '../utils/sectionHelpers.js';
import { getSharedEventAttendance } from '../services/api.js';
import { getToken } from '../services/auth.js';
import { isDemoMode } from '../config/demoMode.js';

function AttendanceView({ events, members, onBack }) {
  // VISIBLE TEST: Add timestamp to DOM to prove component is mounting
  window.ATTENDANCE_VIEW_MOUNTED = new Date().toISOString();
  
  // Debug what members data we're receiving (only log once)
  const [hasLoggedMembers, setHasLoggedMembers] = useState(false);
  if (members?.length > 0 && !hasLoggedMembers) {
    if (import.meta.env.DEV) {
      console.log('🔍 AttendanceView members count:', members.length);
      console.log('🔍 AttendanceView first member keys:', Object.keys(members[0]).sort());
      console.log('🔍 AttendanceView first member data:', members[0]);
    }
    setHasLoggedMembers(true);
  }
  
  // Use custom hooks for data loading and sign-in/out functionality
  const {
    attendanceData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  } = useAttendanceData(events);

  const { buttonLoading, handleSignInOut } = useSignInOut(
    events,
    loadVikingEventData,
  );

  // Local state for UI
  const [filteredAttendanceData, setFilteredAttendanceData] = useState([]);
  const [viewMode, setViewMode] = useState('overview'); // overview, register, detailed, campGroups, sharedAttendance
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);
  const prevViewModeRef = useRef('overview'); // Track previous view mode without extra renders
  const [sortConfig, setSortConfig] = useState({
    key: 'attendance',
    direction: 'desc',
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Attendance filter state - exclude "Not Invited" by default
  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: false,
  });

  // Cache parsed sections data for section name resolution
  const sectionsCache = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem('viking_sections_offline') || '[]',
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to parse cached sections data:', error);
      }
      return [];
    }
  }, []);

  // Section filter state - initialize with all sections enabled
  const [sectionFilters, setSectionFilters] = useState(() => {
    const filters = {};
    const uniqueSections = [...new Set(events.map((e) => e.sectionid))];
    uniqueSections.forEach((sectionId) => {
      // Find the section name to check if it's an Adults section
      const sectionEvent = events.find((e) => e.sectionid === sectionId);
      const sectionName = sectionEvent?.sectionname?.toLowerCase() || '';

      // Set Adults sections to false by default, all others to true
      filters[sectionId] = !sectionName.includes('adults');
    });
    return filters;
  });

  // Refresh Viking Event data when switching to register view from camp groups
  // This ensures updated camp group assignments show in the register
  useEffect(() => {
    const prev = prevViewModeRef.current;
    const switchingToRegister = viewMode === 'register' && prev !== 'register';
    const switchingFromCampGroups = prev === 'campGroups';

    if (switchingToRegister && switchingFromCampGroups) {
      loadVikingEventData();
    }
    // Update previous view mode without triggering re-render
    prevViewModeRef.current = viewMode;
  }, [viewMode, loadVikingEventData]);

  // loadEnhancedMembers function removed - member data now loaded proactively by dashboard

  // Format date and time in UK format (DD/MM/YYYY HH:MM)
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
    } catch {
      return dateString;
    }
  };

  // Viking Event data lookup is now handled by useAttendanceData hook

  const getAttendanceStatus = (attending) => {
    if (attending === 'Yes' || attending === '1') return 'yes';
    if (attending === 'No') return 'no';
    if (attending === 'Invited') return 'invited';
    // Empty string, null, or any other value means not invited
    return 'notInvited';
  };

  // Check if a member should be included in camp groups (same logic as Camp Groups tab)
  const shouldIncludeInSummary = (record) => {
    // Find member details to check person_type
    const memberDetails = members.find(
      (member) => member.scoutid === record.scoutid,
    );
    if (!memberDetails) return true; // Include if we can't find member details

    const personType = memberDetails.person_type;
    // Skip Leaders and Young Leaders - same as Camp Groups filtering
    return personType !== 'Leaders' && personType !== 'Young Leaders';
  };

  // Filter attendance data based on active filters (attendance status + sections + person type)
  const filterAttendanceData = (data, attendanceFilters, sectionFilters) => {
    return data.filter((record) => {
      const attendanceStatus = getAttendanceStatus(record.attending);
      const attendanceMatch = attendanceFilters[attendanceStatus];
      const sectionMatch = sectionFilters[record.sectionid];
      const personTypeMatch = shouldIncludeInSummary(record);

      return attendanceMatch && sectionMatch && personTypeMatch;
    });
  };

  // Filter for record count display - includes all person types
  const filterAttendanceDataForCount = (data, attendanceFilters, sectionFilters) => {
    return data.filter((record) => {
      const attendanceStatus = getAttendanceStatus(record.attending);
      const attendanceMatch = attendanceFilters[attendanceStatus];
      const sectionMatch = sectionFilters[record.sectionid];

      return attendanceMatch && sectionMatch;
    });
  };

  // Update filtered data when attendance data or filters change
  useEffect(() => {
    const filtered = filterAttendanceData(
      attendanceData,
      attendanceFilters,
      sectionFilters,
    );
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if any events are shared events and load shared attendance data
  const hasSharedEvents = useMemo(() => {
    return events.some(event => {
      // Check if this event has shared event metadata stored
      const metadata = localStorage.getItem(`viking_shared_metadata_${event.eventid}`);
      if (metadata) {
        try {
          const parsed = JSON.parse(metadata);
          return parsed._isOwner || parsed._allSections?.length > 1;
        } catch (e) {
          return false;
        }
      }
      return false;
    });
  }, [events]);

  const loadSharedAttendanceData = useCallback(async () => {
    setLoadingSharedAttendance(true);
    try {
      const token = getToken();
      if (!isDemoMode() && !token) {
        throw new Error('No authentication token available');
      }

      // Find the shared event (the one that has shared metadata)
      const sharedEvent = events.find(event => {
        const metadata = localStorage.getItem(`viking_shared_metadata_${event.eventid}`);
        if (metadata) {
          try {
            const parsed = JSON.parse(metadata);
            return parsed._isOwner || parsed._allSections?.length > 1;
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (!sharedEvent) {
        throw new Error('No shared event found');
      }

      if (import.meta.env.DEV) {
        console.log('Loading shared attendance for event:', sharedEvent.eventid, 'section:', sharedEvent.sectionid);
      }
      
      const sharedData = await getSharedEventAttendance(sharedEvent.eventid, sharedEvent.sectionid, token);
      
      if (import.meta.env.DEV) {
        console.log('Received shared attendance data:', sharedData);
      }
      setSharedAttendanceData(sharedData);
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading shared attendance data:', error);
      }
      setSharedAttendanceData({ error: error.message });
    } finally {
      setLoadingSharedAttendance(false);
    }
  }, [events]);

  // Load shared attendance data when switching to shared attendance view
  useEffect(() => {
    if (viewMode === 'sharedAttendance' && hasSharedEvents && !sharedAttendanceData && !loadingSharedAttendance) {
      loadSharedAttendanceData();
    }
  }, [viewMode, hasSharedEvents, sharedAttendanceData, loadingSharedAttendance, loadSharedAttendanceData]);

  const getSummaryStats = () => {
    const memberStats = {};

    // Create person_type lookup like other functions do
    const memberPersonTypes = {};
    if (members && Array.isArray(members)) {
      members.forEach((member) => {
        memberPersonTypes[member.scoutid] = member.person_type || 'Young People';
      });
    }

    filteredAttendanceData.forEach((record) => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          sectionid: record.sectionid, // Store section ID for Viking Event data lookup
          person_type: memberPersonTypes[record.scoutid] || 'Young People', // Add person_type
          yes: 0,
          no: 0,
          invited: 0,
          notInvited: 0,
          total: 0,
          events: [],
          vikingEventData: null, // Will be populated below
        };
      }

      memberStats[memberKey].total++;
      const status = getAttendanceStatus(record.attending);
      memberStats[memberKey][status]++;

      memberStats[memberKey].events.push({
        name: record.eventname,
        date: record.eventdate,
        status: status,
        attending: record.attending,
        sectionname: record.sectionname,
      });
    });

    // Populate Viking Event Management data for each member
    Object.values(memberStats).forEach((member) => {
      const vikingData = getVikingEventDataForMember(member.scoutid, member);

      if (vikingData) {
        member.vikingEventData = {
          CampGroup: vikingData.CampGroup,
          SignedInBy: vikingData.SignedInBy,
          SignedInWhen: vikingData.SignedInWhen,
          SignedOutBy: vikingData.SignedOutBy,
          SignedOutWhen: vikingData.SignedOutWhen,
        };
      }
    });

    return Object.values(memberStats);
  };

  // Sign-in/out functionality is now handled by useSignInOut hook
  // SignInOutButton component is now in separate file

  const getSimplifiedAttendanceSummaryStats = () => {
    const sectionStats = {};
    const totals = {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
      notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
      total: { yp: 0, yl: 0, l: 0, total: 0 },
    };

    // Create a map of scout IDs to person types from members data
    const memberPersonTypes = {};
    if (members && Array.isArray(members)) {
      members.forEach((member) => {
        memberPersonTypes[member.scoutid] =
          member.person_type || 'Young People';
      });
    }

    attendanceData.forEach((record) => {
      const sectionName = record.sectionname || 'Unknown Section';
      const personType = memberPersonTypes[record.scoutid] || 'Young People';
      const status = getAttendanceStatus(record.attending);

      // Initialize section stats if not exists
      if (!sectionStats[sectionName]) {
        sectionStats[sectionName] = {
          name: sectionName,
          yes: { yp: 0, yl: 0, l: 0, total: 0 },
          no: { yp: 0, yl: 0, l: 0, total: 0 },
          invited: { yp: 0, yl: 0, l: 0, total: 0 },
          notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
          total: { yp: 0, yl: 0, l: 0, total: 0 },
        };
      }

      // Map person types to abbreviations
      let roleKey;
      if (personType === 'Young People') roleKey = 'yp';
      else if (personType === 'Young Leaders') roleKey = 'yl';
      else if (personType === 'Leaders') roleKey = 'l';
      else roleKey = 'yp'; // Default unknown to YP

      // Update section-specific counts
      sectionStats[sectionName][status][roleKey]++;
      sectionStats[sectionName][status].total++;
      sectionStats[sectionName].total[roleKey]++;
      sectionStats[sectionName].total.total++;

      // Update totals
      totals[status][roleKey]++;
      totals[status].total++;
      totals.total[roleKey]++;
      totals.total.total++;
    });

    return {
      sections: Object.values(sectionStats),
      totals,
    };
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue, bValue;

      switch (key) {
      case 'member':
        if (viewMode === 'register') {
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
        } else {
          aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
          bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
        }
        break;
      case 'attendance':
        if (viewMode === 'register') {
          // For register, determine primary status for each member and sort by priority
          const getPrimaryStatus = (member) => {
            if (member.yes > 0) return 'yes';
            if (member.no > 0) return 'no';
            if (member.invited > 0) return 'invited';
            if (member.notInvited > 0) return 'notInvited';
            return 'unknown';
          };

          const statusA = getPrimaryStatus(a);
          const statusB = getPrimaryStatus(b);
          // Sort order: yes, no, invited, notInvited (higher values come first in desc)
          const statusOrder = {
            yes: 3,
            no: 2,
            invited: 1,
            notInvited: 0,
            unknown: -1,
          };
          aValue = statusOrder[statusA] || -1;
          bValue = statusOrder[statusB] || -1;
        } else {
          const statusA = getAttendanceStatus(a.attending);
          const statusB = getAttendanceStatus(b.attending);
          // Sort order: yes, no, invited, notInvited (higher values come first in desc)
          const statusOrder = { yes: 3, no: 2, invited: 1, notInvited: 0 };
          aValue = statusOrder[statusA] || 0;
          bValue = statusOrder[statusB] || 0;
        }
        break;
      case 'section':
        aValue = a.sectionname?.toLowerCase() || '';
        bValue = b.sectionname?.toLowerCase() || '';
        break;
      default:
        return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="ml-1 text-gray-400">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M5 12l5-5 5 5H5z" />
            <path d="M5 8l5 5 5-5H5z" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <span className="ml-1 text-scout-blue">
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 12l5-5 5 5H5z" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue">
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 8l5 5 5-5H5z" />
        </svg>
      </span>
    );
  };

  // Helper function to group contact information (reused from MemberDetailModal)
  const groupContactInfo = (member) => {
    const groups = {};

    // Process flattened contact fields
    Object.entries(member).forEach(([key, value]) => {
      if (
        key.includes('__') &&
        value !== undefined &&
        value !== null &&
        !(typeof value === 'string' && value.trim() === '')
      ) {
        const [groupName, fieldName] = key.split('__');
        if (!groups[groupName]) {
          groups[groupName] = {};
        }
        groups[groupName][fieldName] = value;
      }
    });

    // Add legacy fields to appropriate groups
    const hasEmail = member.email !== undefined && member.email !== null && String(member.email).trim() !== '';
    const hasPhone = member.phone !== undefined && member.phone !== null && String(member.phone).trim() !== '';
    if (hasEmail || hasPhone) {
      if (!groups.member_contact) {
        groups.member_contact = {};
      }
      if (hasEmail) groups.member_contact.email = member.email;
      if (hasPhone) groups.member_contact.phone = member.phone;
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
            const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const isEmptyString = typeof fieldValue === 'string' && fieldValue.trim() === '';
            if (fieldValue !== undefined && fieldValue !== null && !isEmptyString) {
              groups[normalizedGroupName][normalizedFieldName] = fieldValue;
            }
          });
        }
      });
    }

    return groups;
  };

  // Transform attendance records to full member objects for the detailed view
  const transformAttendanceToMembers = (attendanceRecords) => {
    return attendanceRecords.map(attendanceRecord => {
      const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
      const fullMember = members?.find((m) => m.scoutid === scoutidAsNumber);
      
      if (!fullMember) {
        // Return minimal member-like object if no full data available
        return {
          scoutid: scoutidAsNumber,
          firstname: attendanceRecord.firstname,
          lastname: attendanceRecord.lastname,
          sectionname: attendanceRecord.sectionname,
          sections: [attendanceRecord.sectionname],
          patrol: attendanceRecord.patrol,
          person_type: attendanceRecord.person_type,
          date_of_birth: null,
          email: attendanceRecord.email || '',
          phone: attendanceRecord.phone || '',
          // Add attendance info
          attending: attendanceRecord.attending,
          attendance_status: getAttendanceStatus(attendanceRecord.attending),
        };
      }
      
      // Return full member data with attendance info added
      return {
        ...fullMember,
        // Add attendance info from the attendance record
        attending: attendanceRecord.attending,
        attendance_status: getAttendanceStatus(attendanceRecord.attending),
      };
    });
  };

  // Extract comprehensive member data for attendance detailed view (legacy - can be removed later)
  const _getComprehensiveMemberData = (attendanceRecord) => {
    // Find the full member data from the members prop
    const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
    const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);
    
    if (!cachedMember) {
      // Return basic data if no comprehensive member data available
      return {
        name: `${attendanceRecord.firstname} ${attendanceRecord.lastname}`,
        section: attendanceRecord.sectionname,
        attendance: attendanceRecord.attending,
        // Basic fallback data
        pc1_name: '',
        pc1_phone: '',
        pc1_email: '',
        allergies: '',
        medical_details: '',
        consent_photos: '',
        consent_sensitive: '',
      };
    }

    const contactGroups = groupContactInfo(cachedMember);
    
    // Helper to normalize consent values for stable pill coloring
    const normalizeConsent = (v) => {
      if (v === undefined || v === null || String(v).trim() === '') return '';
      const s = String(v).trim().toLowerCase();
      if (['yes','y','true','1'].includes(s)) return 'Yes';
      if (['no','n','false','0'].includes(s)) return 'No';
      return v;
    };
    
    // Helper to get field from any group
    const getField = (groupNames, fieldNames) => {
      for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
        const group = contactGroups[groupName];
        if (group) {
          for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
            if (Object.prototype.hasOwnProperty.call(group, fieldName)) return group[fieldName];
          }
        }
      }
      return '';
    };

    // Helper to combine multiple fields
    const combineFields = (groupNames, fieldNames, joiner = ', ') => {
      const values = [];
      for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
        const group = contactGroups[groupName];
        if (group) {
          for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
            const v = group[fieldName];
            if (v !== undefined && v !== null && String(v).trim() !== '') values.push(v);
          }
        }
      }
      return values.join(joiner);
    };

    return {
      // Basic info
      name: `${cachedMember.firstname || cachedMember.first_name} ${cachedMember.lastname || cachedMember.last_name}`,
      section: attendanceRecord.sectionname,
      attendance: attendanceRecord.attending,
      patrol: cachedMember.patrol || '',
      age: cachedMember.date_of_birth ? Math.floor((Date.now() - new Date(cachedMember.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '',
      
      // Primary Contact 1 (check both flattened and nested)
      pc1_name: combineFields(['primary_contact_1'], ['first_name', 'last_name']) || 
                [cachedMember.primary_contact_1__first_name, cachedMember.primary_contact_1__last_name].filter(Boolean).join(' ') || '',
      pc1_phone: combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || 
                 [cachedMember.primary_contact_1__phone_1, cachedMember.primary_contact_1__phone_2].filter(Boolean).join(', ') || '',
      pc1_email: combineFields(['primary_contact_1'], ['email_1', 'email_2']) || 
                 [cachedMember.primary_contact_1__email_1, cachedMember.primary_contact_1__email_2].filter(Boolean).join(', ') || '',
      
      // Emergency Contact (check both flattened and nested)
      ec_name: combineFields(['emergency_contact'], ['first_name', 'last_name']) || 
               [cachedMember.emergency_contact__first_name, cachedMember.emergency_contact__last_name].filter(Boolean).join(' ') || '',
      ec_phone: combineFields(['emergency_contact'], ['phone_1', 'phone_2']) || 
                [cachedMember.emergency_contact__phone_1, cachedMember.emergency_contact__phone_2].filter(Boolean).join(', ') || '',
      
      // Essential Information (check both flattened and nested)
      allergies: getField(['essential_information'], ['allergies']) || cachedMember.essential_information__allergies || '',
      medical_details: getField(['essential_information'], ['medical_details']) || cachedMember.essential_information__medical_details || '',
      dietary_requirements: getField(['essential_information'], ['dietary_requirements']) || cachedMember.essential_information__dietary_requirements || '',
      
      // Consents - General (check nested contact_groups.Consents first, then flattened)
      consent_photos: normalizeConsent(getField(['consents'], ['photographs', 'photos']) || cachedMember.consents__photographs),
      consent_sensitive: normalizeConsent(getField(['consents'], ['sensitive_information']) || cachedMember.consents__sensitive_information),
      
      // Consents - Medical Treatment (check nested contact_groups.Consents first, then flattened)
      consent_paracetamol: normalizeConsent(getField(['consents'], ['paracetamol']) || cachedMember.consents__paracetamol),
      consent_ibuprofen: normalizeConsent(getField(['consents'], ['ibuprofen']) || cachedMember.consents__ibuprofen),
      consent_suncream: normalizeConsent(getField(['consents'], ['suncream', 'sun_cream']) || cachedMember.consents__suncream),
    };
  };

  // Transform cached member data to match what MemberDetailModal expects
  const transformMemberForModal = (cachedMember) => {
    if (!cachedMember) return null;
    
    if (import.meta.env.DEV) {
      console.log('🔄 transformMemberForModal - Checking cached member:', {
        scoutid: cachedMember.scoutid,
        has_firstname: 'firstname' in cachedMember,
        firstname_value: cachedMember.firstname,
        has_first_name: 'first_name' in cachedMember,
        first_name_value: cachedMember.first_name,
        has_lastname: 'lastname' in cachedMember,
        lastname_value: cachedMember.lastname,
        has_last_name: 'last_name' in cachedMember,
        last_name_value: cachedMember.last_name,
      });
    }
    
    // The cached data should already have both firstname and first_name
    // Just ensure firstname/lastname are set (modal uses these)
    // Also resolve section name using the section helper utility
    const memberSectionId = cachedMember.sectionid || cachedMember.section_id;
    const memberSectionName = findMemberSectionName(memberSectionId, sectionsCache);
    
    const transformed = {
      ...cachedMember,
      firstname: cachedMember.firstname || cachedMember.first_name,
      lastname: cachedMember.lastname || cachedMember.last_name,
      sections: [memberSectionName || cachedMember.sectionname || 'Unknown'],
      sectionname: memberSectionName || cachedMember.sectionname, // Also set sectionname for consistency
    };
    
    if (import.meta.env.DEV) {
      console.log('🔄 transformMemberForModal - Result:', {
        firstname: transformed.firstname,
        lastname: transformed.lastname,
      });
    }
    
    return transformed;
  };

  // Handle member click to show detail modal
  const handleMemberClick = (attendanceRecord) => {
    // Find the full member data or create a basic member object
    // Convert scoutid to number for comparison (members array has numeric scoutids)
    const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
    const cachedMember = members?.find(
      (m) => m.scoutid === scoutidAsNumber,
    );
    
    let member;
    if (cachedMember) {
      // Transform the cached data to match modal expectations
      member = transformMemberForModal(cachedMember);
      
      // Debug log to see what data Register/AttendanceView is passing to modal
      if (import.meta.env.DEV) {
        console.log('AttendanceView (Register) - Member clicked, passing to modal:', {
          memberScoutId: member.scoutid,
          memberName: member.name || `${member.firstname} ${member.lastname}`,
          memberKeys: Object.keys(member),
          memberData: member,
          hasContactInfo: !!(member.contact_primary_member || member.contact_primary_1),
          hasMedicalInfo: !!(member.medical || member.dietary || member.allergies),
          totalFields: Object.keys(member).length,
          source: 'transformMemberForModal (cached member)',
        });
      }
    } else {
      // Fallback to basic data from attendance record
      member = {
        scoutid: attendanceRecord.scoutid,
        firstname: attendanceRecord.firstname,
        lastname: attendanceRecord.lastname,
        sections: [attendanceRecord.sectionname],
        person_type: attendanceRecord.person_type || 'Young People',
      };
      
      // Debug log for fallback case
      if (import.meta.env.DEV) {
        console.log('AttendanceView (Register) - Member clicked, passing to modal:', {
          memberScoutId: member.scoutid,
          memberName: `${member.firstname} ${member.lastname}`,
          memberKeys: Object.keys(member),
          memberData: member,
          hasContactInfo: false,
          hasMedicalInfo: false,
          totalFields: Object.keys(member).length,
          source: 'fallback (attendance record only)',
        });
      }
    }

    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading attendance..." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Attendance</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4">
        <Card.Header>
          <Card.Title>No Attendance Data</Card.Title>
          <Button variant="outline-scout-blue" onClick={onBack} type="button">
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body>
          <p className="text-gray-600">
            No attendance data found for the selected event(s).
          </p>
        </Card.Body>
      </Card>
    );
  }

  const summaryStats = getSummaryStats();
  const simplifiedSummaryStats = getSimplifiedAttendanceSummaryStats();

  // Get unique sections from events for the section filter
  const uniqueSections = events.reduce((acc, event) => {
    if (!acc.find((section) => section.sectionid === event.sectionid)) {
      acc.push({
        sectionid: event.sectionid,
        sectionname: event.sectionname,
      });
    }
    return acc;
  }, []);

  return (
    <div>
      {/* Attendance Data Card */}
      <Card className="m-4">
        <Card.Header>
          <Card.Title>
            Attendance Data - {events.length === 1 ? events[0].name : `${events[0].name} (${events.length} sections)`}{' '}
            {(() => {
              const filteredForCount = filterAttendanceDataForCount(attendanceData, attendanceFilters, sectionFilters);
              return filteredForCount.length !== attendanceData.length && (
                <span className="text-sm font-normal text-gray-600">
                  ({filteredForCount.length} of {attendanceData.length}{' '}
                  records)
                </span>
              );
            })()}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline-scout-blue" onClick={onBack} type="button">
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body>
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === 'overview'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('overview')}
                type="button"
              >
                Overview
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === 'register'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('register')}
                type="button"
              >
                Register
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === 'detailed'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('detailed')}
                type="button"
              >
                Detailed
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === 'campGroups'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('campGroups')}
                type="button"
              >
                Camp Groups
              </button>
              {hasSharedEvents && (
                <button
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    viewMode === 'sharedAttendance'
                      ? 'border-scout-blue text-scout-blue'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setViewMode('sharedAttendance')}
                  type="button"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === 'overview' && members && members.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex gap-2 items-center mb-4">
                <Badge variant="scout-green">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-2 py-2 text-center table-header-text text-scout-green uppercase tracking-wider">
                      <div>Yes</div>
                      <div className="flex justify-center mt-1 text-xs">
                        <span className="w-8 text-center">YP</span>
                        <span className="w-8 text-center">YL</span>
                        <span className="w-8 text-center">L</span>
                        <span className="w-12 text-center">Total</span>
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider">
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
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900">
                        {section.name}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-scout-green font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900">
                      Total
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-scout-green font-semibold">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center">
                          {simplifiedSummaryStats.totals.total.total}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {filteredAttendanceData.length === 0 ? (
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
              <Button
                variant="scout-blue"
                onClick={() => {
                  setAttendanceFilters({
                    yes: true,
                    no: true,
                    invited: true,
                    notInvited: true,
                  });
                  // Also reset section filters to show all sections
                  const allSectionsEnabled = {};
                  uniqueSections.forEach((section) => {
                    allSectionsEnabled[section.sectionid] = true;
                  });
                  setSectionFilters(allSectionsEnabled);
                }}
                type="button"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === 'register' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('member')}
                      >
                        <div className="flex items-center">
                          Member {getSortIcon('member')}
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
                          Status {getSortIcon('attendance')}
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
                    {sortData(
                      summaryStats,
                      sortConfig.key,
                      sortConfig.direction,
                    ).map((member, index) => {
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => {
                                // Pass the member object with scoutid so handleMemberClick can find the full cached data
                                handleMemberClick({
                                  scoutid: member.scoutid,
                                  firstname: member.name.split(' ')[0],
                                  lastname: member.name
                                    .split(' ')
                                    .slice(1)
                                    .join(' '),
                                  sectionname: member.events[0]?.sectionname,
                                });
                              }}
                              className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] block text-xs"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex gap-1 flex-wrap">
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge variant="scout-red" className="text-xs">
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge variant="scout-blue" className="text-xs">
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge variant="light" className="text-xs">
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                            {member.vikingEventData?.CampGroup || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                                <div className="space-y-0.5">
                                  <div className="text-gray-900 font-medium leading-tight">
                                    {member.vikingEventData?.SignedInBy || '-'}
                                  </div>
                                  <div className="text-gray-500 text-xs leading-tight">
                                    {member.vikingEventData?.SignedInWhen
                                      ? formatUKDateTime(
                                        member.vikingEventData.SignedInWhen,
                                      )
                                      : '-'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                                <div className="space-y-0.5">
                                  <div className="text-gray-900 font-medium leading-tight">
                                    {member.vikingEventData?.SignedOutBy || '-'}
                                  </div>
                                  <div className="text-gray-500 text-xs leading-tight">
                                    {member.vikingEventData?.SignedOutWhen
                                      ? formatUKDateTime(
                                        member.vikingEventData.SignedOutWhen,
                                      )
                                      : '-'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {viewMode === 'detailed' && (
            <ComprehensiveMemberTable
              members={transformAttendanceToMembers(filteredAttendanceData)}
              onMemberClick={(member) => {
                setSelectedMember(member);
                setShowMemberModal(true);
              }}
              showFilters={true}
              extraColumns={[
                {
                  key: 'attendance_status',
                  title: 'Attendance',
                  group: 'Basic Info',
                  groupColor: 'bg-scout-blue',
                  render: (member) => {
                    let badgeVariant, statusText;
                    
                    switch (member.attendance_status) {
                    case 'yes':
                      badgeVariant = 'scout-green';
                      statusText = 'Yes';
                      break;
                    case 'no':
                      badgeVariant = 'scout-red';
                      statusText = 'No';
                      break;
                    case 'invited':
                      badgeVariant = 'scout-blue';
                      statusText = 'Invited';
                      break;
                    case 'notInvited':
                      badgeVariant = 'secondary';
                      statusText = 'Not Invited';
                      break;
                    default:
                      badgeVariant = 'light';
                      statusText = 'Unknown';
                    }

                    return (
                      <Badge variant={badgeVariant} size="sm">
                        {statusText}
                      </Badge>
                    );
                  },
                },
              ]}
            />
          )}


          {viewMode === 'campGroups' && (
            <CampGroupsView
              events={events}
              attendees={getSummaryStats()}
              members={members}
              onError={(_error) => {
                /* Error handled within CampGroupsView */
              }}
            />
          )}

          {viewMode === 'sharedAttendance' && (
            <div>
              {loadingSharedAttendance ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"></div>
                  <p className="mt-2 text-gray-600">Loading shared attendance data...</p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <Alert variant="danger">
                  <Alert.Title>Error Loading Shared Attendance</Alert.Title>
                  <Alert.Description>{sharedAttendanceData.error}</Alert.Description>
                  <Alert.Actions>
                    <Button variant="scout-blue" onClick={loadSharedAttendanceData} type="button">
                      Retry
                    </Button>
                  </Alert.Actions>
                </Alert>
              ) : sharedAttendanceData?.items ? (
                <div>
                  {(() => {
                    // Helper function to determine if member is young person or adult based on age
                    const isYoungPerson = (age) => {
                      if (!age) return true; // Default to young person if no age
                      return age !== '25+'; // Adults/leaders have '25+', young people have formats like '06 / 08'
                    };

                    // Helper function to get numeric age for sorting (handle years/months format)
                    const getNumericAge = (age) => {
                      if (!age) return 0;
                      if (age === '25+') return 999; // Put adults at the end
                      
                      // Handle format like '06 / 08' which is years / months
                      const match = age.match(/^(\d+)\s*\/\s*(\d+)$/);
                      if (match) {
                        const years = parseInt(match[1], 10);
                        const months = parseInt(match[2], 10);
                        // Convert to total months for accurate sorting
                        return (years * 12) + months;
                      }
                      
                      // Fallback to just first number
                      const singleMatch = age.match(/^(\d+)/);
                      return singleMatch ? parseInt(singleMatch[1], 10) * 12 : 0; // Convert years to months
                    };

                    // Process the data to group by sections
                    const sectionGroups = {};
                    let totalYoungPeople = 0;
                    let totalAdults = 0;
                    
                    sharedAttendanceData.items.forEach(member => {
                      const sectionName = member.sectionname;
                      const isYP = isYoungPerson(member.age);
                      
                      if (isYP) {
                        totalYoungPeople++;
                      } else {
                        totalAdults++;
                      }
                      
                      if (!sectionGroups[sectionName]) {
                        sectionGroups[sectionName] = {
                          sectionid: member.sectionid,
                          sectionname: sectionName,
                          members: [],
                          youngPeopleCount: 0,
                          adultsCount: 0,
                        };
                      }
                      
                      if (isYP) {
                        sectionGroups[sectionName].youngPeopleCount++;
                      } else {
                        sectionGroups[sectionName].adultsCount++;
                      }
                      
                      sectionGroups[sectionName].members.push(member);
                    });
                    
                    // Sort members within each section by age (youngest first, adults last)
                    Object.values(sectionGroups).forEach(section => {
                      section.members.sort((a, b) => {
                        const ageA = getNumericAge(a.age);
                        const ageB = getNumericAge(b.age);
                        return ageA - ageB;
                      });
                    });
                    
                    const sections = Object.values(sectionGroups);
                    const totalMembers = totalYoungPeople + totalAdults;
                    
                    return (
                      <>
                        {/* Overall summary */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Combined Attendance Summary
                          </h3>
                          <div className="flex flex-wrap gap-3">
                            <Badge variant="scout-blue" size="md">
                              {totalMembers} Total
                            </Badge>
                            <Badge variant="scout-green" size="md">
                              {totalYoungPeople} Young People
                            </Badge>
                            <Badge variant="scout-purple" size="md">
                              {totalAdults} Adults
                            </Badge>
                            <Badge variant="light" size="md">
                              {sections.length} Sections
                            </Badge>
                          </div>
                        </div>

                        {/* Group members by section */}
                        {sections.map((section) => (
                          <div key={section.sectionid} className="mb-6">
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                  {section.sectionname}
                                  <div className="flex gap-1">
                                    <Badge variant="scout-green" size="sm">
                                      {section.youngPeopleCount} YP
                                    </Badge>
                                    <Badge variant="scout-purple" size="sm">
                                      {section.adultsCount} Adults
                                    </Badge>
                                  </div>
                                </h4>
                              </div>
                              
                              <div className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {section.members.map((member, memberIndex) => (
                                    <div key={member.scoutid || memberIndex} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                                      <div className="text-sm font-medium text-gray-900 min-w-0 flex-1 mr-2">
                                        {member.firstname} {member.lastname}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono flex-shrink-0">
                                        {member.age || 'N/A'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No shared attendance data available</p>
                  <Button variant="scout-blue" onClick={loadSharedAttendanceData} className="mt-4" type="button">
                    Load Shared Attendance
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default AttendanceView;
