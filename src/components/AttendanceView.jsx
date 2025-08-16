import React, { useState, useEffect, useRef, useMemo } from 'react';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import CompactAttendanceFilter from './CompactAttendanceFilter.jsx';
import SectionFilter from './SectionFilter.jsx';
import CampGroupsView from './CampGroupsView.jsx';
import SignInOutButton from './SignInOutButton.jsx';
import { Card, Button, Badge, Alert } from './ui';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import { useSignInOut } from '../hooks/useSignInOut.js';
import { findMemberSectionName } from '../utils/sectionHelpers.js';

function AttendanceView({ events, members, onBack }) {
  console.log('AttendanceView: component mounted');
  
  // VISIBLE TEST: Add timestamp to DOM to prove component is mounting
  window.ATTENDANCE_VIEW_MOUNTED = new Date().toISOString();
  
  // Debug what members data we're receiving (only log once)
  const [hasLoggedMembers, setHasLoggedMembers] = useState(false);
  if (members?.length > 0 && !hasLoggedMembers) {
    console.log('🔍 AttendanceView members count:', members.length);
    console.log('🔍 AttendanceView first member keys:', Object.keys(members[0]).sort());
    console.log('🔍 AttendanceView first member data:', members[0]);
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
  const [viewMode, setViewMode] = useState('overview'); // overview, register, detailed, campGroups
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
      console.warn('Failed to parse cached sections data:', error);
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

  // Update filtered data when attendance data or filters change
  useEffect(() => {
    const filtered = filterAttendanceData(
      attendanceData,
      attendanceFilters,
      sectionFilters,
    );
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Transform cached member data to match what MemberDetailModal expects
  const transformMemberForModal = (cachedMember) => {
    if (!cachedMember) return null;
    
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
    
    console.log('🔄 transformMemberForModal - Result:', {
      firstname: transformed.firstname,
      lastname: transformed.lastname,
    });
    
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
            Attendance Data{' '}
            {filteredAttendanceData.length !== attendanceData.length && (
              <span className="text-sm font-normal text-gray-600">
                ({filteredAttendanceData.length} of {attendanceData.length}{' '}
                records)
              </span>
            )}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="scout-blue">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
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
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === 'overview' && members && members.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex gap-2 items-center mb-4">
                <Badge variant="scout-blue">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </Badge>
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
                    <th className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider">
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
                    <th className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider">
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
                      <td className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold">
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
                      <td className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold">
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
                    <td className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold">
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
                    <td className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold">
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
                          <td className="px-3 py-4">
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
                              className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] block"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td className="px-2 py-4 text-center">
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
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
                                <Badge variant="secondary" className="text-xs">
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {member.vikingEventData?.CampGroup || '-'}
                          </td>
                          <td className="px-3 py-4 text-sm">
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
                          <td className="px-3 py-4 text-sm">
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('member')}
                    >
                      <div className="flex items-center">
                        Member {getSortIcon('member')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('section')}
                    >
                      <div className="flex items-center">
                        Section {getSortIcon('section')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('attendance')}
                    >
                      <div className="flex items-center">
                        Attendance {getSortIcon('attendance')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          {record.sectionname}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={badgeVariant}>{statusText}</Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                            <div className="text-gray-500 text-xs mt-1">
                                Raw: &quot;{record.attending}&quot;
                            </div>
                          )}
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
            />
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
