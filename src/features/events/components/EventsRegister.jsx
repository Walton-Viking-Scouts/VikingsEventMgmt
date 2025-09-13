import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../../shared/utils/cn';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { MemberDetailModal } from '../../../shared/components/ui';
import SignInOutButton from './SignInOutButton.jsx';
import CompactAttendanceFilter from './CompactAttendanceFilter.jsx';
import { useAttendanceData } from '../hooks/useAttendanceData.js';
import { useSignInOut } from '../../../shared/hooks/useSignInOut.js';
import { notifyError, notifyWarning } from '../../../shared/utils/notifications.js';
import databaseService from '../../../shared/services/storage/database.js';
import { getUniqueSectionsFromEvents } from '../../../shared/utils/sectionHelpers.js';
import { findMemberSectionName } from '../../../shared/utils/sectionHelpers.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * EventsRegister component provides event attendance management functionality
 * 
 * Displays a comprehensive interface for managing event attendance, including member
 * registration, attendance tracking, and filtering capabilities. Supports both
 * individual and bulk attendance operations with real-time updates.
 * 
 * @component
 * @returns {JSX.Element} Rendered events register interface
 * 
 * @example
 * // Basic usage - typically routed to with event data
 * <EventsRegister />
 * 
 * @since 2.3.7
 */
function EventsRegister() {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal and UI state
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  
  // Filtering state
  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: true,
  });

  const [sectionFilters, setSectionFilters] = useState({});

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'member', direction: 'asc' });


  // Get events data from navigation state or load from database
  useEffect(() => {
    const loadEventsData = async () => {
      try {
        setLoading(true);
        
        // Try to get events from router state first (if navigated from dashboard)
        const stateEvents = location.state?.events;
        const stateMembers = location.state?.members;
        
        if (stateEvents && stateEvents.length > 0) {
          setEvents(stateEvents);
          setMembers(stateMembers || []);
        } else {
          // Fallback: load events from database
          const eventsData = await databaseService.getEvents();
          setEvents(eventsData || []);
          
          if (eventsData && eventsData.length > 0) {
            const sectionsInvolved = Array.from(new Set(eventsData.map((e) => e.sectionid)));
            const membersData = await databaseService.getMembers(sectionsInvolved);
            setMembers(membersData || []);
          }
        }
      } catch (err) {
        logger.error('Failed to load events data for register', { error: err.message }, LOG_CATEGORIES.ERROR);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEventsData();
  }, [location.state]);

  // Use attendance data hook for registration data
  const {
    attendanceData,
    loading: attendanceLoading,
    error: attendanceError,
    loadVikingEventData,
  } = useAttendanceData(events);

  // Use sign in/out hook
  const { buttonLoading, handleSignInOut } = useSignInOut(
    events,
    loadVikingEventData,
    { notifyError, notifyWarning },
  );

  // Initialize section filters when events/members load
  useEffect(() => {
    if (events.length > 0) {
      const uniqueSections = getUniqueSectionsFromEvents(events);
      const initialFilters = {};
      uniqueSections.forEach((section) => {
        initialFilters[section.sectionid] = true;
      });
      setSectionFilters(initialFilters);
    }
  }, [events]);

  // Create summary stats for the register view
  const summaryStats = useMemo(() => {
    if (!events.length || !members.length || !attendanceData.length) {
      return [];
    }

    // Group attendance data by member
    const memberStats = {};
    
    attendanceData.forEach(attendance => {
      const scoutidAsNumber = parseInt(attendance.scoutid, 10);
      const member = members.find(m => m.scoutid === scoutidAsNumber);
      
      if (!member) return;

      const memberId = member.scoutid;
      if (!memberStats[memberId]) {
        memberStats[memberId] = {
          scoutid: memberId,
          name: `${member.firstname} ${member.lastname}`.trim(),
          sectionname: findMemberSectionName(member, events),
          events: [],
        };
      }

      memberStats[memberId].events.push(attendance);
    });

    return Object.values(memberStats);
  }, [events, members, attendanceData]);

  // Filter summary stats based on current filters
  const filteredSummaryStats = useMemo(() => {
    return summaryStats.filter(member => {
      // Section filter
      const memberSectionId = members.find(m => m.scoutid === member.scoutid)?.sectionid;
      if (memberSectionId && !sectionFilters[memberSectionId]) {
        return false;
      }

      // Attendance filter - check if member has any events matching attendance filters
      const hasMatchingAttendance = member.events.some(event => {
        if (event.attending === 'yes' && attendanceFilters.yes) return true;
        if (event.attending === 'no' && attendanceFilters.no) return true;
        return false;
      });

      const isInvited = member.events.length > 0;
      const isNotInvited = member.events.length === 0;

      if (isInvited && !attendanceFilters.invited) return false;
      if (isNotInvited && !attendanceFilters.notInvited) return false;

      return hasMatchingAttendance || isNotInvited;
    });
  }, [summaryStats, sectionFilters, attendanceFilters, members]);

  // Sort data
  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue, bValue;

      switch (key) {
      case 'member':
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case 'attendance':
        // Sort by primary attendance status
        aValue = a.events[0]?.attending || 'none';
        bValue = b.events[0]?.attending || 'none';
        break;
      default:
        aValue = a[key] || '';
        bValue = b[key] || '';
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Handle member click for detailed view
  const handleMemberClick = (member) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Get comprehensive member data for modal
  const getComprehensiveMemberData = (memberData) => {
    const scoutidAsNumber = parseInt(memberData.scoutid, 10);
    const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);
    
    if (!cachedMember) {
      return {
        name: `${memberData.firstname || ''} ${memberData.lastname || ''}`.trim(),
        section: memberData.sectionname || '',
        attendance: 'Unknown',
        patrol: '',
        age: '',
      };
    }

    return {
      ...cachedMember,
      name: `${cachedMember.firstname || ''} ${cachedMember.lastname || ''}`.trim(),
      section: findMemberSectionName(cachedMember, events),
    };
  };

  if (loading || attendanceLoading) {
    return <LoadingScreen message="Loading events register..." />;
  }

  if (error || attendanceError) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm p-6')}>
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Register</h2>
              <p>{error || attendanceError}</p>
              <button
                onClick={() => navigate('/events')}
                className="mt-4 px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <Link
              to="/events/overview"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Overview
            </Link>
            <Link
              to="/events/register"
              className="border-scout-blue text-scout-blue border-b-2 py-2 px-1 text-sm font-medium"
            >
              Register
            </Link>
            <Link
              to="/events/camp-groups"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 py-2 px-1 text-sm font-medium"
            >
              Camp Groups
            </Link>
          </nav>
        </div>

        <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm p-6')}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Event Registration</h2>
            <p className="text-gray-600 mt-1">
              Manage event attendance and sign-in/out for members
            </p>
          </div>

          {/* Filters */}
          {events.length > 0 && (
            <div className="mb-6">
              <CompactAttendanceFilter
                attendanceFilters={attendanceFilters}
                onAttendanceFilterChange={setAttendanceFilters}
                sectionFilters={sectionFilters}
                onSectionFilterChange={setSectionFilters}
                uniqueSections={getUniqueSectionsFromEvents(events)}
              />
            </div>
          )}

          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9H5a1 1 0 110-2h3zM9 3h6v4H9V3zm0 6h6v9H9V9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Available</h3>
              <p className="text-gray-600 mb-4">
                No events found for registration. Make sure you&apos;re connected and data has been synced.
              </p>
              <Link
                to="/events"
                className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : filteredSummaryStats.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Records Match Filters</h3>
              <p className="text-gray-600 mb-4">
                No attendance records match your current filter settings. Try adjusting the filters above.
              </p>
              <button
                className="inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base bg-scout-blue text-white hover:bg-scout-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue-light active:bg-scout-blue-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  setAttendanceFilters({
                    yes: true,
                    no: true,
                    invited: true,
                    notInvited: true,
                  });
                  // Reset section filters to show all sections
                  const allSectionsEnabled = {};
                  getUniqueSectionsFromEvents(events).forEach((section) => {
                    allSectionsEnabled[section.sectionid] = true;
                  });
                  setSectionFilters(allSectionsEnabled);
                }}
                type="button"
              >
                Show All Records
              </button>
            </div>
          ) : (
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
                      Section
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Events Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortData(filteredSummaryStats, sortConfig.key, sortConfig.direction).map((member, index) => {
                    const primaryEvent = member.events[0];
                    const rawStatus = primaryEvent?.attending ?? '';
                    const attendanceStatus = String(rawStatus).toLowerCase();
                    
                    return (
                      <tr key={member.scoutid || index} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleMemberClick({
                              scoutid: member.scoutid,
                              firstname: member.name.split(' ')[0],
                              lastname: member.name.split(' ').slice(1).join(' '),
                              sectionname: member.sectionname,
                            })}
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
                          <span
                            className={cn(
                              'inline-flex items-center font-medium rounded-full px-3 py-1 text-sm',
                              (() => {
                                if (attendanceStatus === 'yes') return 'bg-scout-green text-white';
                                if (attendanceStatus === 'no') return 'bg-scout-red text-white';
                                if (attendanceStatus === 'invited') return 'bg-scout-blue text-white';
                                return 'bg-gray-50 text-gray-600 border border-gray-200';
                              })(),
                            )}
                          >
                            {(() => {
                              if (attendanceStatus === 'yes') return 'Attending';
                              if (attendanceStatus === 'no') return 'Not Attending';
                              if (attendanceStatus === 'invited') return 'Invited';
                              return 'Not Invited';
                            })()}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {member.sectionname}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {member.events.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Member Detail Modal */}
        {showMemberModal && selectedMember && (
          <MemberDetailModal
            memberData={getComprehensiveMemberData(selectedMember)}
            isOpen={showMemberModal}
            onClose={() => {
              setShowMemberModal(false);
              setSelectedMember(null);
            }}
            vikingEventData={getComprehensiveMemberData(selectedMember)}
          />
        )}
      </div>
    </div>
  );
}

export default EventsRegister;