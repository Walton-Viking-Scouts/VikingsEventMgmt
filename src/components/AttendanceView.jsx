import React, { useState, useEffect, useMemo } from 'react';
import { getEventAttendance, fetchMostRecentTermId, updateFlexiRecord, getFlexiRecords } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import CompactAttendanceFilter from './CompactAttendanceFilter.jsx';
import SectionFilter from './SectionFilter.jsx';
import CampGroupsView from './CampGroupsView.jsx';
import { getVikingEventDataForEvents, getFlexiRecordStructure } from '../services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { Card, Button, Badge, Alert } from './ui';
import { safeGetItem, safeGetSessionItem } from '../utils/storageUtils.js';

function AttendanceView({ events, members, onBack }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [filteredAttendanceData, setFilteredAttendanceData] = useState([]);
  const [vikingEventData, setVikingEventData] = useState(new Map()); // Map of sectionId to flexirecord data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed, campGroups
  const [sortConfig, setSortConfig] = useState({ key: 'attendance', direction: 'desc' });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [buttonLoading, setButtonLoading] = useState({}); // Track loading state for each member button
  
  // Attendance filter state - exclude "Not Invited" by default
  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: false,
  });
  
  // Section filter state - initialize with all sections enabled
  const [sectionFilters, setSectionFilters] = useState(() => {
    const filters = {};
    const uniqueSections = [...new Set(events.map(e => e.sectionid))];
    uniqueSections.forEach(sectionId => {
      // Find the section name to check if it's an Adults section
      const sectionEvent = events.find(e => e.sectionid === sectionId);
      const sectionName = sectionEvent?.sectionname?.toLowerCase() || '';
      
      // Set Adults sections to false by default, all others to true
      filters[sectionId] = !sectionName.includes('adults');
    });
    return filters;
  });

  useEffect(() => {
    loadAttendance();
    // Note: Member data should already be loaded by dashboard background loading
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allAttendance = [];
      
      // Check if events already have cached attendance data
      for (const event of events) {
        if (event.attendanceData && Array.isArray(event.attendanceData)) {
          // Use cached attendance data
          const attendanceWithEvent = event.attendanceData.map(record => ({
            ...record,
            eventid: event.eventid,
            eventname: event.name,
            eventdate: event.startdate,
            sectionid: event.sectionid,
            sectionname: event.sectionname,
          }));
          allAttendance.push(...attendanceWithEvent);
        } else {
          // Fallback to API call if no cached data
          try {
            const token = getToken();
            
            // If termid is missing, get it from API
            let termId = event.termid;
            if (!termId) {
              termId = await fetchMostRecentTermId(event.sectionid, token);
            }
            
            if (termId) {
              const attendance = await getEventAttendance(
                event.sectionid, 
                event.eventid, 
                termId, 
                token,
              );
              
              if (attendance && Array.isArray(attendance)) {
                // Add event info to each attendance record
                const attendanceWithEvent = attendance.map(record => ({
                  ...record,
                  eventid: event.eventid,
                  eventname: event.name,
                  eventdate: event.startdate,
                  sectionid: event.sectionid,
                  sectionname: event.sectionname,
                }));
                allAttendance.push(...attendanceWithEvent);
              }
            } else {
              console.warn(`No termid found for event ${event.name} in section ${event.sectionid}`);
            }
          } catch (eventError) {
            console.warn(`Error loading attendance for event ${event.name}:`, eventError);
          }
        }
      }
      
      setAttendanceData(allAttendance);
      
      // Load Viking Event Management data (fresh when possible, cache as fallback)
      await loadVikingEventData();
      
    } catch (err) {
      console.error('Error loading attendance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Viking Event Management flexirecord data (fresh preferred, cache fallback)
  const loadVikingEventData = async () => {
    try {
      const token = getToken();
      
      // Load Viking Event Management data for all sections
      // getVikingEventDataForEvents handles section-term combinations correctly
      const vikingEventMap = await getVikingEventDataForEvents(events, token);
      setVikingEventData(vikingEventMap);
      
    } catch (error) {
      console.warn('Error loading Viking Event Management data:', error);
      // Don't set error state as this is supplementary data
    }
  };

  // loadEnhancedMembers function removed - member data now loaded proactively by dashboard

  const _formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

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

  // Create a memoized lookup map for Viking Event data to improve performance
  // Builds once when vikingEventData changes, provides O(1) lookups instead of O(n×m) searches
  const vikingEventLookup = useMemo(() => {
    const lookup = new Map();
    for (const [, sectionData] of vikingEventData.entries()) {
      if (sectionData && sectionData.items) {
        sectionData.items.forEach(item => {
          lookup.set(item.scoutid, item);
        });
      }
    }
    return lookup;
  }, [vikingEventData]);

  // Get Viking Event Management data for a specific member using optimized O(1) lookup
  const getVikingEventDataForMember = (scoutid, _memberEventData) => {
    return vikingEventLookup.get(scoutid) || null;
  };

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
    const memberDetails = members.find(member => member.scoutid === record.scoutid);
    if (!memberDetails) return true; // Include if we can't find member details
    
    const personType = memberDetails.person_type;
    // Skip Leaders and Young Leaders - same as Camp Groups filtering
    return personType !== 'Leaders' && personType !== 'Young Leaders';
  };

  // Filter attendance data based on active filters (attendance status + sections + person type)
  const filterAttendanceData = (data, attendanceFilters, sectionFilters) => {
    return data.filter(record => {
      const attendanceStatus = getAttendanceStatus(record.attending);
      const attendanceMatch = attendanceFilters[attendanceStatus];
      const sectionMatch = sectionFilters[record.sectionid];
      const personTypeMatch = shouldIncludeInSummary(record);
      
      return attendanceMatch && sectionMatch && personTypeMatch;
    });
  };

  // Update filtered data when attendance data or filters change
  useEffect(() => {
    const filtered = filterAttendanceData(attendanceData, attendanceFilters, sectionFilters);
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSummaryStats = () => {
    const memberStats = {};
    
    filteredAttendanceData.forEach(record => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          sectionid: record.sectionid, // Store section ID for Viking Event data lookup
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
    Object.values(memberStats).forEach(member => {
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

  // Helper function to get current user info from session storage
  const getCurrentUserInfo = () => {
    const userInfo = safeGetSessionItem('user_info', {});
    return {
      firstname: userInfo.firstname || 'Unknown',
      lastname: userInfo.lastname || 'User',
    };
  };

  // Helper function to get field ID from field mapping
  const getFieldId = (meaningfulName, fieldMapping) => {
    for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
      if (fieldInfo.name === meaningfulName) {
        return fieldId;
      }
    }
    throw new Error(`Field '${meaningfulName}' not found in flexirecord structure`);
  };

  // Helper function to find Viking Event Mgmt flexirecord for a section
  const getVikingEventFlexiRecord = async (sectionId, termId) => {
    const token = getToken();
    const flexiRecords = await getFlexiRecords(sectionId, token);
    
    // Find the "Viking Event Mgmt" flexirecord
    const vikingRecord = flexiRecords.items.find(record => 
      record.name && record.name.toLowerCase().includes('viking event'),
    );
    
    if (!vikingRecord) {
      throw new Error('Viking Event Mgmt flexirecord not found for this section');
    }
    
    const structure = await getFlexiRecordStructure(vikingRecord.extraid, sectionId, termId, token);
    
    return {
      extraid: vikingRecord.extraid,
      structure: structure,
      fieldMapping: parseFlexiStructure(structure),
    };
  };

  // Main sign in/out handler
  const handleSignInOut = async (member, action) => {
    try {
      // Set loading state for this specific button
      setButtonLoading(prev => ({ ...prev, [member.scoutid]: true }));
      
      // Get current user info from cached startup data
      const userInfo = getCurrentUserInfo();
      const currentUser = `${userInfo.firstname} ${userInfo.lastname}`;
      const timestamp = new Date().toISOString();
      
      // Get termId from events
      const event = events.find(e => e.sectionid === member.sectionid);
      const termId = event?.termid || await fetchMostRecentTermId(member.sectionid, getToken());
      
      if (!termId) {
        throw new Error('No term ID available - required for flexirecord updates');
      }
      
      // Get section type from cached section config
      const cachedSections = safeGetItem('vikings_sections_offline', []);
      const sectionConfig = cachedSections.find(section => section.sectionid == member.sectionid);
      const sectionType = sectionConfig?.sectiontype || 'beavers'; // fallback to beavers if not found
      
      // Get Viking Event Mgmt flexirecord structure for this section
      const vikingFlexiRecord = await getVikingEventFlexiRecord(member.sectionid, termId);
      
      if (action === 'signin') {
        // Sign in requires two API calls: SignedInBy and SignedInWhen
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedInBy', vikingFlexiRecord.fieldMapping),
          currentUser,
          termId,
          sectionType,
          getToken(),
        );
        
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedInWhen', vikingFlexiRecord.fieldMapping),
          timestamp,
          termId,
          sectionType,
          getToken(),
        );
        
        // Clear signed out fields if they have values (only make API calls if needed)
        const hasSignedOutBy = member.vikingEventData?.SignedOutBy && 
                               member.vikingEventData.SignedOutBy !== '-' && 
                               member.vikingEventData.SignedOutBy.trim() !== '';
        const hasSignedOutWhen = member.vikingEventData?.SignedOutWhen && 
                                 member.vikingEventData.SignedOutWhen !== '-' && 
                                 member.vikingEventData.SignedOutWhen.trim() !== '';
        
        if (hasSignedOutBy) {
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            getToken(),
          );
        }
        
        if (hasSignedOutWhen) {
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            getToken(),
          );
        }
        
        console.log(`Successfully signed in ${member.name}`);
      } else {
        // Sign out requires two API calls: SignedOutBy and SignedOutWhen
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
          currentUser,
          termId,
          sectionType,
          getToken(),
        );
        
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
          timestamp,
          termId,
          sectionType,
          getToken(),
        );
        
        console.log(`Successfully signed out ${member.name}`);
      }
      
      // Refresh Viking Event data to show updates
      await loadVikingEventData();
      
    } catch (error) {
      console.error(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${member.name}:`, error);
      
      // Show toast notification for error (using console.error for now, will add proper toast)
      alert(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${member.name}: ${error.message}`);
      
    } finally {
      // Clear loading state for this button
      setButtonLoading(prev => ({ ...prev, [member.scoutid]: false }));
    }
  };

  // SignInOutButton component
  const SignInOutButton = ({ member, onSignInOut, loading }) => {
    const isSignedIn = member.vikingEventData?.SignedInBy && 
                       member.vikingEventData?.SignedInBy !== '-' &&
                       member.vikingEventData?.SignedInBy.trim() !== '';
    const isSignedOut = member.vikingEventData?.SignedOutBy && 
                        member.vikingEventData?.SignedOutBy !== '-' &&
                        member.vikingEventData?.SignedOutBy.trim() !== '';
    
    // Show Sign In if not signed in, Sign Out if signed in but not signed out
    const action = isSignedIn && !isSignedOut ? 'signout' : 'signin';
    const label = action === 'signin' ? 'Sign In' : 'Sign Out';
    
    // Use pill-style button like existing filter buttons
    const baseStyles = 'px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 hover:shadow-sm min-w-16';
    const activeStyles = action === 'signin' 
      ? 'bg-scout-green text-white hover:bg-scout-green-dark' 
      : 'bg-scout-red text-white hover:bg-scout-red-dark';
    
    return (
      <button
        onClick={() => onSignInOut(member, action)}
        disabled={loading}
        className={`${baseStyles} ${activeStyles} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
        title={`${label} ${member.name}`}
      >
        {loading ? '...' : label}
      </button>
    );
  };

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
      members.forEach(member => {
        memberPersonTypes[member.scoutid] = member.person_type || 'Young People';
      });
    }
    
    attendanceData.forEach(record => {
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
        if (viewMode === 'summary') {
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
        } else {
          aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
          bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
        }
        break;
      case 'attendance':
        if (viewMode === 'summary') {
          // For summary, determine primary status for each member and sort by priority
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
          const statusOrder = { yes: 3, no: 2, invited: 1, notInvited: 0, unknown: -1 };
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
          <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 12l5-5 5 5H5z"/>
            <path d="M5 8l5 5 5-5H5z"/>
          </svg>
        </span>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <span className="ml-1 text-scout-blue">
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 12l5-5 5 5H5z"/>
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue">
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 8l5 5 5-5H5z"/>
        </svg>
      </span>
    );
  };

  // Handle member click to show detail modal
  const handleMemberClick = (attendanceRecord) => {
    // Find the full member data or create a basic member object
    const member = members?.find(m => m.scoutid === attendanceRecord.scoutid) || {
      scoutid: attendanceRecord.scoutid,
      firstname: attendanceRecord.firstname,
      lastname: attendanceRecord.lastname,
      sections: [attendanceRecord.sectionname],
      person_type: attendanceRecord.person_type || 'Young People',
    };
    
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
            onClick={loadAttendance}
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
          <Button 
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
          >
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
    if (!acc.find(section => section.sectionid === event.sectionid)) {
      acc.push({
        sectionid: event.sectionid,
        sectionname: event.sectionname,
      });
    }
    return acc;
  }, []);

  return (
    <div>
      {/* Simplified Attendance Summary Card */}
      {members && members.length > 0 && (
        <Card className="m-4">
          <Card.Header>
            <Card.Title>Attendance Summary</Card.Title>
            <div className="flex gap-2 items-center">
              <Badge variant="scout-blue">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="scout-green">
                {simplifiedSummaryStats.totals.total.total} total responses
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="overflow-x-auto">
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
                          <span className="w-8 text-center">{section.yes.yp}</span>
                          <span className="w-8 text-center">{section.yes.yl}</span>
                          <span className="w-8 text-center">{section.yes.l}</span>
                          <span className="w-12 text-center">{section.yes.total}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">{section.no.yp}</span>
                          <span className="w-8 text-center">{section.no.yl}</span>
                          <span className="w-8 text-center">{section.no.l}</span>
                          <span className="w-12 text-center">{section.no.total}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">{section.invited.yp}</span>
                          <span className="w-8 text-center">{section.invited.yl}</span>
                          <span className="w-8 text-center">{section.invited.l}</span>
                          <span className="w-12 text-center">{section.invited.total}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">{section.notInvited.yp}</span>
                          <span className="w-8 text-center">{section.notInvited.yl}</span>
                          <span className="w-8 text-center">{section.notInvited.l}</span>
                          <span className="w-12 text-center">{section.notInvited.total}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">{section.total.yp}</span>
                          <span className="w-8 text-center">{section.total.yl}</span>
                          <span className="w-8 text-center">{section.total.l}</span>
                          <span className="w-12 text-center">{section.total.total}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-3 py-3 whitespace-nowrap table-header-text font-bold text-gray-900 border-t-2 border-gray-300">
                      Totals
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.yes.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.yes.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.yes.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.yes.total}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.no.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.no.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.no.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.no.total}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.invited.total}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.notInvited.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.notInvited.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.notInvited.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.notInvited.total}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.total.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.total.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.total.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.total.total}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}


      {/* Attendance Data Card */}
      <Card className="m-4">
        <Card.Header>
          <Card.Title>
            Attendance Data {filteredAttendanceData.length !== attendanceData.length && (
              <span className="text-sm font-normal text-gray-600">
                ({filteredAttendanceData.length} of {attendanceData.length} records)
              </span>
            )}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="scout-blue">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
            <Button 
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
            >
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
                  viewMode === 'summary' 
                    ? 'border-scout-blue text-scout-blue' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setViewMode('summary')}
                type="button"
              >
              Summary
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

          {filteredAttendanceData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Records Match Filters</h3>
              <p className="text-gray-600 mb-4">
                No attendance records match your current filter settings. Try adjusting the filters above to see more data.
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
                  uniqueSections.forEach(section => {
                    allSectionsEnabled[section.sectionid] = true;
                  });
                  setSectionFilters(allSectionsEnabled);
                }}
                type="button"
              >
                Show All Records
              </Button>
            </div>
          ) : viewMode === 'summary' && (
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
                      onClick={() => handleSort('attendance')}
                    >
                      <div className="flex items-center">
                    Attendance Status {getSortIcon('attendance')}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Camp Group
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signed In By
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signed In When
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signed Out By
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signed Out When
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortData(summaryStats, sortConfig.key, sortConfig.direction).map((member, index) => {
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleMemberClick({ scoutid: member.scoutid, firstname: member.name.split(' ')[0], lastname: member.name.split(' ').slice(1).join(' '), sectionname: member.events[0]?.sectionname })}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                          >
                            {member.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2 flex-wrap">
                            {member.yes > 0 && (
                              <Badge variant="scout-green" className="text-xs">
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
                        <td className="px-3 py-4 whitespace-nowrap">
                          <SignInOutButton 
                            member={member}
                            onSignInOut={handleSignInOut}
                            loading={buttonLoading?.[member.scoutid] || false}
                          />
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.vikingEventData?.SignedInBy || '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.vikingEventData?.SignedInWhen ? formatUKDateTime(member.vikingEventData.SignedInWhen) : '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.vikingEventData?.SignedOutBy || '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.vikingEventData?.SignedOutWhen ? formatUKDateTime(member.vikingEventData.SignedOutWhen) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  {sortData(filteredAttendanceData, sortConfig.key, sortConfig.direction).map((record, index) => {
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
                          <Badge variant={badgeVariant}>
                            {statusText}
                          </Badge>
                          {record.attending && record.attending !== statusText && (
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
              attendees={filteredAttendanceData}
              members={members}
              onError={(error) => setError(error.message)}
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
