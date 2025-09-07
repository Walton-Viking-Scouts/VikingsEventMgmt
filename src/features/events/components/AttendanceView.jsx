import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import MemberDetailModal from '../../sections/components/MemberDetailModal.jsx';
import CompactAttendanceFilter from './CompactAttendanceFilter.jsx';
import { SectionFilter, SectionCardsFlexMasonry } from '../../sections';
import CampGroupsView from './CampGroupsView.jsx';
import SignInOutButton from './SignInOutButton.jsx';
import { Card, Button, Badge } from '../../../shared/components/ui';
import AlertAdapter from '../../../shared/components/ui/AlertAdapter.jsx';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import { useSignInOut } from '../../../shared/hooks/useSignInOut.js';
import { findMemberSectionName } from '../../../shared/utils/sectionHelpers.js';
import { getSharedEventAttendance } from '../../../shared/services/api/api.js';
import { getToken } from '../../auth/services/auth.js';
import { isDemoMode } from '../../../config/demoMode.js';
import { MedicalDataPill } from '../../sections/components/MedicalDataDisplay.jsx';
import { formatMedicalDataForDisplay } from '../../../shared/utils/medicalDataUtils.js';
import { groupContactInfo } from '../../../shared/utils/contactGroups.js';

function AttendanceView({ events, members, onBack }) {
  // VISIBLE TEST: Add timestamp to DOM to prove component is mounting
  if (import.meta.env.DEV) {
    window.ATTENDANCE_VIEW_MOUNTED = new Date().toISOString();
  }


  // Use custom hooks for data loading and sign-in/out functionality
  const {
    attendanceData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  } = useAttendanceData(events);

  // Get notification handlers for the sign-in/out hook
  const { notifyError, notifyWarning, notifySuccess } = useNotification();

  const { buttonLoading, handleSignInOut } = useSignInOut(
    events,
    loadVikingEventData,
    { notifyError, notifyWarning },
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

  // Data filter state - for controlling which columns to show
  const [dataFilters, setDataFilters] = useState({
    contacts: false, // Primary and Emergency contacts (hidden by default as requested)
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

  // Helper function to group contact information (reused from MemberDetailModal)
  // Use shared groupContactInfo utility

  // Extract comprehensive member data for attendance detailed view
  const getComprehensiveMemberData = (attendanceRecord) => {
    // Find the full member data from the members prop
    const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
    const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);
    
    if (!cachedMember) {
      // Return basic fallback data if member not found
      return {
        name: `${attendanceRecord.firstname} ${attendanceRecord.lastname}`,
        section: attendanceRecord.sectionname,
        attendance: attendanceRecord.attending,
        patrol: '',
        age: '',
        pc1_name: '',
        pc1_phone: '',
        pc1_email: '',
        ec_name: '',
        ec_phone: '',
        allergies: '',
        medical_details: '',
        dietary_requirements: '',
        consent_photos: '',
        consent_sensitive: '',
        consent_paracetamol: '',
        consent_ibuprofen: '',
        consent_suncream: '',
      };
    }

    const contactGroups = groupContactInfo(cachedMember);
    
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
      name: `${cachedMember.firstname || cachedMember.first_name} ${cachedMember.lastname || cachedMember.last_name}`,
      section: attendanceRecord.sectionname,
      attendance: attendanceRecord.attending,
      patrol: cachedMember.patrol || '',
      age: cachedMember.date_of_birth ? Math.floor((Date.now() - new Date(cachedMember.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '',
      
      // Primary Contacts (1 and 2)
      primary_contacts: (() => {
        const contacts = [];
        
        // Primary Contact 1
        const pc1_name = combineFields(['primary_contact_1'], ['first_name', 'last_name'], ' ') || 
                        [cachedMember.primary_contact_1__first_name, cachedMember.primary_contact_1__last_name].filter(Boolean).join(' ') || '';
        const pc1_phone = combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || 
                         [cachedMember.primary_contact_1__phone_1, cachedMember.primary_contact_1__phone_2].filter(Boolean).join(', ') || '';
        const pc1_email = combineFields(['primary_contact_1'], ['email_1', 'email_2']) || 
                         [cachedMember.primary_contact_1__email_1, cachedMember.primary_contact_1__email_2].filter(Boolean).join(', ') || '';
        
        if (pc1_name || pc1_phone || pc1_email) {
          contacts.push({ name: pc1_name, phone: pc1_phone, email: pc1_email, label: 'PC1' });
        }
        
        // Primary Contact 2
        const pc2_name = combineFields(['primary_contact_2'], ['first_name', 'last_name'], ' ') || 
                        [cachedMember.primary_contact_2__first_name, cachedMember.primary_contact_2__last_name].filter(Boolean).join(' ') || '';
        const pc2_phone = combineFields(['primary_contact_2'], ['phone_1', 'phone_2']) || 
                         [cachedMember.primary_contact_2__phone_1, cachedMember.primary_contact_2__phone_2].filter(Boolean).join(', ') || '';
        const pc2_email = combineFields(['primary_contact_2'], ['email_1', 'email_2']) || 
                         [cachedMember.primary_contact_2__email_1, cachedMember.primary_contact_2__email_2].filter(Boolean).join(', ') || '';
        
        if (pc2_name || pc2_phone || pc2_email) {
          contacts.push({ name: pc2_name, phone: pc2_phone, email: pc2_email, label: 'PC2' });
        }
        
        return contacts;
      })(),
      
      // Emergency Contacts
      emergency_contacts: (() => {
        const contacts = [];
        
        // Emergency Contact
        const ec_name = combineFields(['emergency_contact'], ['first_name', 'last_name'], ' ') || 
                       [cachedMember.emergency_contact__first_name, cachedMember.emergency_contact__last_name].filter(Boolean).join(' ') || '';
        const ec_phone = combineFields(['emergency_contact'], ['phone_1', 'phone_2']) || 
                        [cachedMember.emergency_contact__phone_1, cachedMember.emergency_contact__phone_2].filter(Boolean).join(', ') || '';
        
        if (ec_name || ec_phone) {
          contacts.push({ name: ec_name, phone: ec_phone, label: 'Emergency' });
        }
        
        return contacts;
      })(),
      
      // Essential Information (check both flattened and nested)
      allergies: getField(['essential_information'], ['allergies']) || cachedMember.essential_information__allergies || '',
      medical_details: getField(['essential_information'], ['medical_details']) || cachedMember.essential_information__medical_details || '',
      dietary_requirements: getField(['essential_information'], ['dietary_requirements']) || cachedMember.essential_information__dietary_requirements || '',
      
      // Consents - General (check nested contact_groups.Consents first, then flattened)
      consent_photos: getField(['consents'], ['photographs', 'photos']) || cachedMember.consents__photographs || '',
      consent_sensitive: getField(['consents'], ['sensitive_information']) || cachedMember.consents__sensitive_information || '',
      
      // Consents - Medical Treatment (check nested contact_groups.Consents first, then flattened)
      consent_paracetamol: getField(['consents'], ['paracetamol']) || cachedMember.consents__paracetamol || '',
      consent_ibuprofen: getField(['consents'], ['ibuprofen']) || cachedMember.consents__ibuprofen || '',
      consent_suncream: getField(['consents'], ['suncream', 'sun_cream']) || cachedMember.consents__suncream || '',
    };
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
  const filterAttendanceDataForCount = (
    data,
    attendanceFilters,
    sectionFilters,
  ) => {
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
    return events.some((event) => {
      // Check if this event has shared event metadata stored
      const metadata = localStorage.getItem(
        `viking_shared_metadata_${event.eventid}`,
      );
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
      // Find the shared event (the one that has shared metadata)
      const sharedEvent = events.find((event) => {
        const metadata = localStorage.getItem(
          `viking_shared_metadata_${event.eventid}`,
        );
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


      // First try to load from cache for offline support
      const cacheKey = `viking_shared_attendance_${sharedEvent.eventid}_${sharedEvent.sectionid}_offline`;
      let cachedData = null;

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedData = JSON.parse(cached);
        }
      } catch (cacheError) {
        if (import.meta.env.DEV) {
          console.warn(
            'Failed to parse cached shared attendance data:',
            cacheError,
          );
        }
      }

      const token = getToken();
      let sharedData = null;

      // Try API call if we have a token and not in demo mode
      if (!isDemoMode() && token) {
        try {
          sharedData = await getSharedEventAttendance(
            sharedEvent.eventid,
            sharedEvent.sectionid,
            token,
          );
        } catch (apiError) {
          if (import.meta.env.DEV) {
            console.warn(
              'API call failed, will use cached data if available:',
              apiError,
            );
          }
          // If API fails, fallback to cached data
          if (cachedData) {
            sharedData = cachedData;
          } else {
            throw apiError; // Re-throw if no cached data available
          }
        }
      } else if (isDemoMode()) {
        // In demo mode, let getSharedEventAttendance handle it
        sharedData = await getSharedEventAttendance(
          sharedEvent.eventid,
          sharedEvent.sectionid,
          token,
        );
      } else {
        // No token and not demo mode - use cached data or fail gracefully
        if (cachedData) {
          sharedData = cachedData;
        } else {
          throw new Error(
            'No authentication token available and no cached data found',
          );
        }
      }

      // Normalize data shape - UI expects 'items' but API may return 'combined_attendance'
      const normalised = sharedData?.items
        ? sharedData
        : { ...sharedData, items: sharedData?.combined_attendance || [] };
      setSharedAttendanceData(normalised);
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
    if (
      viewMode === 'sharedAttendance' &&
      hasSharedEvents &&
      !sharedAttendanceData &&
      !loadingSharedAttendance
    ) {
      loadSharedAttendanceData();
    }
  }, [
    viewMode,
    hasSharedEvents,
    sharedAttendanceData,
    loadingSharedAttendance,
    loadSharedAttendanceData,
  ]);

  const getSummaryStats = () => {
    const memberStats = {};

    // Create person_type lookup like other functions do
    const memberPersonTypes = {};
    if (members && Array.isArray(members)) {
      members.forEach((member) => {
        memberPersonTypes[member.scoutid] =
          member.person_type || 'Young People';
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

  const exportToCSV = () => {
    if (filteredAttendanceData.length === 0) {
      notifyWarning('No attendance data to export');
      return;
    }

    try {
      const headers = [
        'First Name',
        'Last Name', 
        'Section',
        'Attendance Status',
        'Patrol',
        'Age',
        'Date of Birth',
        'Address',
        'Postcode',
        'Primary Contact 1 Name',
        'Primary Contact 1 Phone',
        'Primary Contact 1 Email',
        'Primary Contact 2 Name',
        'Primary Contact 2 Phone', 
        'Primary Contact 2 Email',
        'Emergency Contact Name',
        'Emergency Contact Phone',
        'Allergies',
        'Medical Details',
        'Dietary Requirements',
        'Photo Consent',
        'Sensitive Info Consent',
        'Paracetamol Consent',
        'Ibuprofen Consent',
        'Suncream Consent',
        'Camp Group',
        'Signed In By',
        'Signed In When',
        'Signed Out By',
        'Signed Out When',
      ];

      const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const idMap = new Map((members || []).map(m => [parseInt(m.scoutid, 10), m]));
      const csvRows = [
        headers.map(csv).join(','),
        ...filteredAttendanceData.map((record) => {
          const memberData = getComprehensiveMemberData(record);
          const vikingData = getVikingEventDataForMember(record.scoutid, record);
          const cachedMember = idMap.get(parseInt(record.scoutid, 10));

          const pc1 = memberData.primary_contacts[0] || {};
          const pc2 = memberData.primary_contacts[1] || {};
          const ec = memberData.emergency_contacts[0] || {};

          return [
            csv(record.firstname),
            csv(record.lastname),
            csv(record.sectionname),
            csv(record.attending),
            csv(memberData.patrol),
            csv(memberData.age),
            csv(cachedMember?.date_of_birth || ''),
            csv(cachedMember?.address || ''),
            csv(cachedMember?.postcode || ''),
            csv(pc1.name || ''),
            csv(pc1.phone || ''),
            csv(pc1.email || ''),
            csv(pc2.name || ''),
            csv(pc2.phone || ''),
            csv(pc2.email || ''),
            csv(ec.name || ''),
            csv(ec.phone || ''),
            csv(formatMedicalDataForDisplay(memberData.allergies, 'allergies').csvValue),
            csv(formatMedicalDataForDisplay(memberData.medical_details, 'medical_details').csvValue),
            csv(formatMedicalDataForDisplay(memberData.dietary_requirements, 'dietary_requirements').csvValue),
            csv(memberData.consent_photos),
            csv(memberData.consent_sensitive),
            csv(memberData.consent_paracetamol),
            csv(memberData.consent_ibuprofen),
            csv(memberData.consent_suncream),
            csv(vikingData?.CampGroup || ''),
            csv(vikingData?.SignedInBy || ''),
            csv(vikingData?.SignedInWhen || ''),
            csv(vikingData?.SignedOutBy || ''),
            csv(vikingData?.SignedOutWhen || ''),
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
      
      const eventName = events.length === 1 ? events[0].name : 'multiple_events';
      const safeEventName = eventName.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      
      link.setAttribute('download', `attendance_${safeEventName}_${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      
      notifySuccess(`Exported ${filteredAttendanceData.length} attendance records`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      notifyError('Failed to export attendance data');
    }
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
        <span className="ml-1 text-gray-400" data-oid="hky8s4_">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="7a0cmvk"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="ws2n6af" />
            <path d="M5 8l5 5 5-5H5z" data-oid="8y-gq9n" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <span className="ml-1 text-scout-blue" data-oid="b5fgmwp">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="exm83.n"
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="x:yzbc." />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="s604e64">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="ybmfdz."
        >
          <path d="M5 8l5 5 5-5H5z" data-oid="tz42rax" />
        </svg>
      </span>
    );
  };

  // Transform cached member data to match what MemberDetailModal expects
  const transformMemberForModal = (cachedMember) => {
    if (!cachedMember) return null;


    // The cached data should already have both firstname and first_name
    // Just ensure firstname/lastname are set (modal uses these)
    // Also resolve section name using the section helper utility
    const memberSectionId = cachedMember.sectionid || cachedMember.section_id;
    const memberSectionName = findMemberSectionName(
      memberSectionId,
      sectionsCache,
    );

    const transformed = {
      ...cachedMember,
      firstname: cachedMember.firstname || cachedMember.first_name,
      lastname: cachedMember.lastname || cachedMember.last_name,
      sections: [memberSectionName || cachedMember.sectionname || 'Unknown'],
      sectionname: memberSectionName || cachedMember.sectionname, // Also set sectionname for consistency
    };


    return transformed;
  };

  // Handle member click to show detail modal
  const handleMemberClick = (attendanceRecord) => {
    // Find the full member data or create a basic member object
    // Convert scoutid to number for comparison (members array has numeric scoutids)
    const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
    const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);

    let member;
    if (cachedMember) {
      // Transform the cached data to match modal expectations
      member = transformMemberForModal(cachedMember);

    } else {
      // Fallback to basic data from attendance record
      member = {
        scoutid: attendanceRecord.scoutid,
        firstname: attendanceRecord.firstname,
        lastname: attendanceRecord.lastname,
        sections: [attendanceRecord.sectionname],
        person_type: attendanceRecord.person_type || 'Young People',
      };

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
    return <LoadingScreen message="Loading attendance..." data-oid="-y6b53c" />;
  }

  if (error) {
    return (
      <AlertAdapter variant="error" className="m-4" data-oid="5nk7oc1">
        <AlertAdapter.Title data-oid="gdmkjf4">Error Loading Attendance</AlertAdapter.Title>
        <AlertAdapter.Description data-oid="wocpjmy">{error}</AlertAdapter.Description>
        <AlertAdapter.Actions data-oid="gzzqd80">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid="_0-wv0d"
          >
            Retry
          </Button>
        </AlertAdapter.Actions>
      </AlertAdapter>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid="fai61bk">
        <Card.Header data-oid="dzgq8xp">
          <Card.Title data-oid="9nfo8lb">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid="63p:_tn"
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="q5ceueo">
          <p className="text-gray-600" data-oid="g8bw7c7">
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
    <div data-oid="v.vx4k3">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid="d4qs42k">
        <Card.Header className="flex items-start justify-between" data-oid="z7y_o.h">
          <Card.Title className="flex-1" data-oid="7b203a0">
            Attendance Data -{' '}
            {events.length === 1
              ? events[0].name
              : `${events[0].name} (${events.length} sections)`}{' '}
            {(() => {
              const filteredForCount = filterAttendanceDataForCount(
                attendanceData,
                attendanceFilters,
                sectionFilters,
              );
              return (
                filteredForCount.length !== attendanceData.length && (
                  <span
                    className="text-sm font-normal text-gray-600"
                    data-oid="dky3bp:"
                  >
                    ({filteredForCount.length} of {attendanceData.length}{' '}
                    records)
                  </span>
                )
              );
            })()}
          </Card.Title>

          <div className="flex space-x-3 ml-4">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAttendanceData.length === 0}
              type="button"
              className="flex items-center"
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
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
            >
              Back to Dashboard
            </Button>
          </div>

        </Card.Header>

        <Card.Body data-oid="d5wiqsj">
          {/* Filters Section */}
          {attendanceData.length > 0 && (
            <div className="space-y-3 mb-6 p-3 bg-gray-50 rounded-lg" data-oid="cqun3c:">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attendance Status:
                  </label>
                  <CompactAttendanceFilter
                    filters={attendanceFilters}
                    onFiltersChange={setAttendanceFilters}
                    data-oid="-te0kw7"
                  />
                </div>

                {uniqueSections.length > 1 && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sections:
                    </label>
                    <SectionFilter
                      sectionFilters={sectionFilters}
                      onFiltersChange={setSectionFilters}
                      sections={uniqueSections}
                      data-oid="d8vur.l"
                    />
                  </div>
                )}

                {viewMode === 'detailed' && (
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
                )}
              </div>
            </div>
          )}

          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="a-.v.39">
            <nav className="-mb-px flex flex-wrap space-x-4 sm:space-x-8" data-oid=".r.4i39">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  viewMode === 'overview'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('overview')}
                type="button"
                data-oid="ud6je5a"
              >
                Overview
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  viewMode === 'register'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('register')}
                type="button"
                data-oid="pruinjp"
              >
                Register
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  viewMode === 'detailed'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('detailed')}
                type="button"
                data-oid="2a-y822"
              >
                Detailed
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  viewMode === 'campGroups'
                    ? 'border-scout-blue text-scout-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('campGroups')}
                type="button"
                data-oid="1kn:pos"
              >
                Camp Groups
              </button>
              {hasSharedEvents && (
                <button
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    viewMode === 'sharedAttendance'
                      ? 'border-scout-blue text-scout-blue'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setViewMode('sharedAttendance')}
                  type="button"
                  data-oid="nbv6bxr"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === 'overview' && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="oiod0mn">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="ielnbct"
              >
                <thead className="bg-gray-50" data-oid="8vdbw9r">
                  <tr data-oid="xh5ytds">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="2tlryno"
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-700 uppercase tracking-wider"
                      data-oid="b_5bs-7"
                    >
                      <div data-oid="ekj3985">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="rxcozoo"
                      >
                        <span className="w-8 text-center" data-oid="1ep0uto">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="n_l4l27">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="ry-j73s">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="gh7:-5-">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-700 uppercase tracking-wider"
                      data-oid="gjxjkl1"
                    >
                      <div data-oid="qguy-0:">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="kktj3y0"
                      >
                        <span className="w-8 text-center" data-oid="8hdjm5_">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="wknclqj">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="y09qf.v">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="663lyw.">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-scout-blue uppercase tracking-wider"
                      data-oid="c5kwm25"
                    >
                      <div data-oid="gj1n.32">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="szosujg"
                      >
                        <span className="w-8 text-center" data-oid="u2kldm0">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="c_xqj5l">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="u37jl2e">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="gp18zid">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="yiqh4r2"
                    >
                      <div data-oid="y0fn6om">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="a:441wk"
                      >
                        <span className="w-8 text-center" data-oid="bsglbm7">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="29yv_hg">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="b_38qa4">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="fm288i3">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="f4lprhk"
                    >
                      <div data-oid="vt2in.w">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="b_2-heb"
                      >
                        <span className="w-8 text-center" data-oid="ciso8_l">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="7loh5qv">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="eo2ft2j">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="0.5xss6">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="5m.l55g"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="d3l2ysp"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="yv-w4wb"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-700 font-semibold"
                        data-oid="kq.5u4i"
                      >
                        <div className="flex justify-center" data-oid="-.vk28s">
                          <span className="w-8 text-center" data-oid="9xksglq">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="7dxe.p:">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="6mi2h.s">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid="s:v-9i5">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-700 font-semibold"
                        data-oid="dfkucp2"
                      >
                        <div className="flex justify-center" data-oid="_n:.p1d">
                          <span className="w-8 text-center" data-oid="sh25-jy">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="yy8_-jq">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="1k6jsqs">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="8p6ofyz">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold"
                        data-oid=":hl9aw_"
                      >
                        <div className="flex justify-center" data-oid="okguymu">
                          <span className="w-8 text-center" data-oid="0r-fdj8">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="0i2pb97">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="k9t92-x">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="a0ukond">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="uxeqr1_"
                      >
                        <div className="flex justify-center" data-oid="5z179yx">
                          <span className="w-8 text-center" data-oid="kr88lwl">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="l5u:nyx">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="k.7mm-e">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="h6t_hgy">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="xgdqvr0"
                      >
                        <div className="flex justify-center" data-oid="glohp-c">
                          <span className="w-8 text-center" data-oid="-3t5saz">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="8h1soin">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="xl-b4us">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid=".6pef73">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="_fr5i2w">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="o1s1dh_"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-700 font-semibold"
                      data-oid="d-fivts"
                    >
                      <div className="flex justify-center" data-oid="xu7kgtq">
                        <span className="w-8 text-center" data-oid="z59:ufv">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="ddvmga:">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="kizl9bf">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="n-5psx1">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-700 font-semibold"
                      data-oid="damvax1"
                    >
                      <div className="flex justify-center" data-oid="1xdc8ce">
                        <span className="w-8 text-center" data-oid="mp.mq5y">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="ed4_.1b">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="4ugzs0t">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="p9xv4g5">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-scout-blue font-semibold"
                      data-oid="t11g11h"
                    >
                      <div className="flex justify-center" data-oid="ya5z_6i">
                        <span className="w-8 text-center" data-oid="ve4:rx-">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="gpvcara">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="2w04f0k">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="im-1c9i">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="ko4j.:r"
                    >
                      <div className="flex justify-center" data-oid="rj7o6lk">
                        <span className="w-8 text-center" data-oid="1d2lcok">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="6vlkcuk">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="_is_ng1">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid=":bzaolv">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="7:r_642"
                    >
                      <div className="flex justify-center" data-oid="1bdbp7i">
                        <span className="w-8 text-center" data-oid="ikziv_g">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="y4a1a68">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="67tkeql">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="p4fw7b8">
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
            <div className="text-center py-12" data-oid="_jl9u1w">
              <div className="text-gray-500 mb-4" data-oid="-.dt3ba">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="p2-69.l"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="j.8..40"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="jd-ewf-"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid="tax13.8">
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
                data-oid="6b9w8uy"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === 'register' && (
              <div className="overflow-x-auto" data-oid="w7m-tzf">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid="9ved61-"
                >
                  <thead className="bg-gray-50" data-oid="aat62fq">
                    <tr data-oid="nf_fnzu">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('member')}
                        data-oid="4fqbk_t"
                      >
                        <div className="flex items-center" data-oid="95.3o.q">
                          Member {getSortIcon('member')}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=".7mpy2t"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('attendance')}
                        data-oid="8sv.ii."
                      >
                        <div className="flex items-center" data-oid="whdz_3z">
                          Status {getSortIcon('attendance')}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="7a.avev"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=":8sq9hj"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="2xdnzrx"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid="4t0fpju"
                  >
                    {sortData(
                      summaryStats,
                      sortConfig.key,
                      sortConfig.direction,
                    ).map((member, index) => {
                      return (
                        <tr
                          key={member.scoutid || index}
                          className="hover:bg-gray-50"
                          data-oid="dcezi3q"
                        >
                          <td className="px-3 py-2" data-oid="zfzll8d">
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
                              data-oid="uzzxv-3"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-2 text-center"
                            data-oid="jjvg_sv"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid=":jah2y4"
                            />
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap"
                            data-oid="z3k83n8"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="4pkp6e."
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="i.afax7"
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="..1bqq-"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="d5oixv9"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="light"
                                  className="text-xs"
                                  data-oid="droy0lh"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-900"
                            data-oid="dfn_ggw"
                          >
                            {member.vikingEventData?.CampGroup || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="q-8ecs7">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                                <div className="space-y-0.5" data-oid="2:.oam3">
                                  <div
                                    className="text-gray-900 font-medium leading-tight"
                                    data-oid="g:cv.3z"
                                  >
                                    {member.vikingEventData?.SignedInBy || '-'}
                                  </div>
                                  <div
                                    className="text-gray-500 text-xs leading-tight"
                                    data-oid="0vpduez"
                                  >
                                    {member.vikingEventData?.SignedInWhen
                                      ? formatUKDateTime(
                                        member.vikingEventData.SignedInWhen,
                                      )
                                      : '-'}
                                  </div>
                                </div>
                              ) : (
                                <span
                                  className="text-gray-400"
                                  data-oid="mjid:y9"
                                >
                                -
                                </span>
                              )}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="h.ozqa3">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                                <div className="space-y-0.5" data-oid="aglpaqx">
                                  <div
                                    className="text-gray-900 font-medium leading-tight"
                                    data-oid="ef6vr48"
                                  >
                                    {member.vikingEventData?.SignedOutBy || '-'}
                                  </div>
                                  <div
                                    className="text-gray-500 text-xs leading-tight"
                                    data-oid="eml0-b."
                                  >
                                    {member.vikingEventData?.SignedOutWhen
                                      ? formatUKDateTime(
                                        member.vikingEventData.SignedOutWhen,
                                      )
                                      : '-'}
                                  </div>
                                </div>
                              ) : (
                                <span
                                  className="text-gray-400"
                                  data-oid="yy:3ulr"
                                >
                                -
                                </span>
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
            <div className="overflow-x-auto" data-oid="ggnwymg">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="jo-1oxg"
              >
                <thead className="bg-gray-50" data-oid="gvt1cmh">
                  <tr data-oid="9bjivav">
                    {/* Basic Info Headers */}
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50"
                      onClick={() => handleSort('member')}
                      data-oid=":e8g3m_"
                    >
                      <div className="flex items-center" data-oid="vr14n:v">
                        Member {getSortIcon('member')}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('section')}
                      data-oid="blw6dhj"
                    >
                      <div className="flex items-center" data-oid="hsntyc.">
                        Section {getSortIcon('section')}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('attendance')}
                      data-oid="-bqy-.h"
                    >
                      <div className="flex items-center" data-oid=".d0cyow">
                        Attendance {getSortIcon('attendance')}
                      </div>
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
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="9_qcd7e"
                >
                  {sortData(
                    filteredAttendanceData,
                    sortConfig.key,
                    sortConfig.direction,
                  ).map((record, index) => {
                    const status = getAttendanceStatus(record.attending);
                    let badgeVariant, statusText;

                    switch (status) {
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
                      badgeVariant = 'secondary';
                      statusText = 'Unknown';
                      break;
                    }

                    // Get comprehensive member data
                    const memberData = getComprehensiveMemberData(record);

                    return (
                      <tr key={record.scoutid || index} className="hover:bg-gray-50 text-xs">
                        {/* Basic Info Cells */}
                        <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white">
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                          >
                            {memberData.name}
                          </button>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                          {memberData.section}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant={badgeVariant} size="sm">{statusText}</Badge>
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
                        
                        {/* Medical Info Cells */}
                        <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                          <div className="max-w-[8rem]">
                            <MedicalDataPill 
                              value={memberData.allergies} 
                              fieldName="allergies"
                              className="text-xs break-words"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                          <div className="max-w-[8rem]">
                            <MedicalDataPill 
                              value={memberData.medical_details} 
                              fieldName="medical_details"
                              className="text-xs break-words"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-900 bg-orange-25 w-32">
                          <div className="max-w-[8rem]">
                            <MedicalDataPill 
                              value={memberData.dietary_requirements} 
                              fieldName="dietary_requirements"
                              className="text-xs break-words"
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

          {viewMode === 'campGroups' && (
            <CampGroupsView
              events={events}
              attendees={getSummaryStats()}
              members={members}
              onError={(_error) => {
                /* Error handled within CampGroupsView */
              }}
              data-oid="7-zdadd"
            />
          )}

          {viewMode === 'sharedAttendance' && (
            <div className="relative" data-oid="9.d0x7u">
              {loadingSharedAttendance ? (
                <div className="text-center py-8" data-oid="23uyl_q">
                  <div
                    className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"
                    data-oid="j.i_em-"
                  ></div>
                  <p className="mt-2 text-gray-600" data-oid=":9umlwt">
                    Loading shared attendance data...
                  </p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <AlertAdapter variant="error" data-oid="ugipkjs">
                  <AlertAdapter.Title data-oid="f4axccr">
                    Error Loading Shared Attendance
                  </AlertAdapter.Title>
                  <AlertAdapter.Description data-oid="epeqvmg">
                    {sharedAttendanceData.error}
                  </AlertAdapter.Description>
                  <AlertAdapter.Actions data-oid="xkspa._">
                    <Button
                      variant="scout-blue"
                      onClick={loadSharedAttendanceData}
                      type="button"
                      data-oid="vrpnw__"
                    >
                      Retry
                    </Button>
                  </AlertAdapter.Actions>
                </AlertAdapter>
              ) : sharedAttendanceData?.items ? (
                <div data-oid="2y6ra21">
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
                        return years * 12 + months;
                      }

                      // Fallback to just first number
                      const singleMatch = age.match(/^(\d+)/);
                      return singleMatch
                        ? parseInt(singleMatch[1], 10) * 12
                        : 0; // Convert years to months
                    };

                    // Process the data to group by sections
                    const sectionGroups = {};
                    let totalYoungPeople = 0;
                    let totalAdults = 0;

                    sharedAttendanceData.items.forEach((member) => {
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
                    Object.values(sectionGroups).forEach((section) => {
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
                        <div className="p-4 border-b border-gray-200" data-oid="v4fnjyf">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900" data-oid="m1r6z5c">
                              All Sections ({sections.length})
                            </h3>
                            <div className="flex gap-2 text-sm text-gray-600" data-oid="7tqb8wm">
                              <span>{totalMembers} total</span>
                              <span>•</span>
                              <span>{totalYoungPeople} YP</span>
                              <span>•</span>
                              <span>{totalAdults} adults</span>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable masonry container */}
                        <div className="max-h-[600px] overflow-y-auto">
                          <SectionCardsFlexMasonry 
                            sections={sections} 
                            isYoungPerson={isYoungPerson}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8" data-oid="v.k.yo9">
                  <p className="text-gray-600" data-oid="6f6hcyb">
                    No shared attendance data available
                  </p>
                  <Button
                    variant="scout-blue"
                    onClick={loadSharedAttendanceData}
                    className="mt-4"
                    type="button"
                    data-oid="vkmik4k"
                  >
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
        data-oid="90obllm"
      />
    </div>
  );
}

export default AttendanceView;
