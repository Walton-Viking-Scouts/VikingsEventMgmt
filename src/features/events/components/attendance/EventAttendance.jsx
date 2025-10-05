import React, { useState, useEffect, useMemo } from 'react';
import { SectionCardsFlexMasonry } from '../../../../shared/components/ui';
import LoadingScreen from '../../../../shared/components/LoadingScreen.jsx';
import { MemberDetailModal } from '../../../../shared/components/ui';
import CampGroupsView from '../CampGroupsView.jsx';
import ClearSignInDataModal from '../ClearSignInDataModal.jsx';
import { notifyError, notifyWarning, notifySuccess, notifyInfo } from '../../../../shared/utils/notifications.js';
import { useAttendanceData } from '../../hooks/useAttendanceData.js';
import { useSignInOut } from '../../../../shared/hooks/useSignInOut.js';
import { useSharedAttendance } from '../../hooks/useSharedAttendance.js';
import { bulkClearSignInData } from '../../services/signInDataService.js';
import { getToken } from '../../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../../shared/services/utils/logger.js';
import eventDataLoader from '../../../../shared/services/data/eventDataLoader.js';
import { isFieldCleared } from '../../../../shared/constants/signInDataConstants.js';
import { checkAttendanceMatch, incrementAttendanceCount, updateSectionCountsByAttendance } from '../../../../shared/utils/attendanceHelpers.js';

import AttendanceHeader from './AttendanceHeader.jsx';
import AttendanceFilters from './AttendanceFilters.jsx';
import AttendanceTabNavigation from './AttendanceTabNavigation.jsx';
import OverviewTab from './OverviewTab.jsx';
import RegisterTab from './RegisterTab.jsx';
import DetailedTab from './DetailedTab.jsx';

/*
 * PERSON_TYPE HANDLING STRATEGY
 *
 * person_type is stored in the database member_section table and should NOT be calculated at runtime.
 *
 * Data Flow:
 * 1. OSM API provides patrol_id (-2 = Leaders, -3 = Young Leaders, other = Young People)
 * 2. members.js transforms patrol_id to person_type ONCE during API data fetch
 * 3. Database stores person_type in member_section table (via IndexedDB or SQLite)
 * 4. Components read person_type from database - no calculations needed
 *
 * Lookup Strategy (in this component):
 * 1. Check section-specific person_type from memberData.sections array (preferred)
 * 2. Fallback to top-level memberData.person_type if section-specific not found
 * 3. DO NOT calculate person_type from age - this causes incorrect categorization
 *
 * Why age-based calculation is wrong:
 * - 17-year-old Young Leader would be incorrectly categorized as "Young People"
 * - 19-year-old Young Person (e.g., with disability) would be incorrectly categorized as "Leader"
 * - Database is the single source of truth for person_type
 */

// Centralized function to check if a member has actual sign-in data (not cleared)
const hasSignInData = (vikingEventData) => {
  if (!vikingEventData) return false;

  return (
    (vikingEventData.SignedInBy && !isFieldCleared(vikingEventData.SignedInBy)) ||
    (vikingEventData.SignedInWhen && !isFieldCleared(vikingEventData.SignedInWhen)) ||
    (vikingEventData.SignedOutBy && !isFieldCleared(vikingEventData.SignedOutBy)) ||
    (vikingEventData.SignedOutWhen && !isFieldCleared(vikingEventData.SignedOutWhen))
  );
};

/**
 * Derives person_type for a member in a specific section context
 * @param {Object} memberData - Member data from membersById map
 * @param {Object} record - Attendance record with sectionid
 * @returns {string|null} person_type value or null if not determinable
 */
const getPersonType = (memberData, record) => {
  // 1. Check section-specific person_type (preferred)
  if (memberData?.sections && Array.isArray(memberData.sections)) {
    const sectionMembership = memberData.sections.find(s => s.sectionid === record.sectionid);
    if (sectionMembership?.person_type) {
      return sectionMembership.person_type;
    }
  }

  // 2. Fallback to top-level person_type
  if (memberData?.person_type) {
    return memberData.person_type;
  }

  // 3. Age-based fallback (only for shared attendees without section membership)
  if (memberData?.age_years) {
    return memberData.age_years >= 18 ? 'Leaders' : 'Young People';
  }

  return null;
};

function EventAttendance({ events, members: membersProp, onBack }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    attendanceData,
    members,
    vikingEventData,
    loading,
    error,
    loadVikingEventData,
  } = useAttendanceData(events, membersProp, refreshTrigger);



  const { buttonLoading, handleSignInOut, getVikingEventFlexiRecord } = useSignInOut(
    events,
    loadVikingEventData,
    { notifyError, notifyWarning },
  );

  const [filteredAttendanceData, setFilteredAttendanceData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const {
    sharedAttendanceData,
    loadingSharedAttendance,
    hasSharedEvents,
  } = useSharedAttendance(events, activeTab);

  const [sortConfig, setSortConfig] = useState({
    key: 'attendance',
    direction: 'desc',
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: false,
    invited: false,
    notInvited: false,
  });

  const [dataFilters, setDataFilters] = useState({
    contacts: false,
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingSignInData, setClearingSignInData] = useState(false);
  const [refreshingAttendance, setRefreshingAttendance] = useState(false);
  const [lastAttendanceRefresh, setLastAttendanceRefresh] = useState(null);

  const [sectionFilters, setSectionFilters] = useState(() => {
    const filters = {};
    const uniqueSections = [...new Set(events.map((e) => e.sectionid))];
    uniqueSections.forEach((sectionId) => {
      const sectionEvent = events.find((e) => e.sectionid === sectionId);
      const sectionName = sectionEvent?.sectionname?.toLowerCase() || '';
      filters[sectionId] = !sectionName.includes('adults');
    });
    return filters;
  });

  const uniqueSections = useMemo(() => {
    return [...new Set(events.map((e) => e.sectionid))].map((sectionId) => {
      const sectionEvent = events.find((e) => e.sectionid === sectionId);
      return {
        sectionid: sectionId,
        sectionname: sectionEvent?.sectionname || `Section ${sectionId}`,
      };
    });
  }, [events]);


  const applyFilters = (attendanceData, attendanceFilters, sectionFilters, includeAttendanceFilter = true) => {
    if (!attendanceData || !Array.isArray(attendanceData)) return [];

    return attendanceData.filter((record) => {
      const attending = record.attending;
      const statusMatch = includeAttendanceFilter
        ? checkAttendanceMatch(attending, attendanceFilters)
        : true;

      const recordSectionId = record.sectionid;
      const sectionMatch = !recordSectionId || sectionFilters[recordSectionId] !== false;

      return statusMatch && sectionMatch;
    });
  };

  useEffect(() => {
    const filtered = applyFilters(attendanceData, attendanceFilters, sectionFilters);
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]);

  // Pre-index members by scoutid for O(1) lookups instead of O(n)
  const membersById = useMemo(
    () => new Map(members.map(m => [String(m.scoutid), m])),
    [members],
  );

  const summaryStats = useMemo(() => {
    if (!filteredAttendanceData || filteredAttendanceData.length === 0) {
      return [];
    }

    const memberMap = new Map();

    filteredAttendanceData.forEach((record) => {
      const key = record.scoutid;
      if (!memberMap.has(key)) {
        const memberData = membersById.get(String(record.scoutid));
        const personType = getPersonType(memberData, record);

        memberMap.set(key, {
          scoutid: record.scoutid,
          name: `${record.firstname} ${record.lastname}`,
          firstname: record.firstname,
          lastname: record.lastname,
          sectionid: record.sectionid,
          events: [],
          yes: 0,
          no: 0,
          invited: 0,
          notInvited: 0,
          vikingEventData: record.vikingEventData,
          isSignedIn: Boolean(
            record.vikingEventData?.SignedInBy &&
            !isFieldCleared(record.vikingEventData.SignedInBy) &&
            (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
          ),
          person_type: personType,
          patrol_id: memberData?.patrol_id,
          patrolid: memberData?.patrolid,
        });
      }

      const member = memberMap.get(key);
      member.events.push(record);

      // Fix: Ensure sectionid matches the record with actual sign-in data
      if (record.vikingEventData) {
        if (!member.vikingEventData) {
          member.sectionid = record.sectionid;  // Set section to match sign-in data
        }
        member.vikingEventData = record.vikingEventData;
        member.isSignedIn = Boolean(
          record.vikingEventData?.SignedInBy &&
          !isFieldCleared(record.vikingEventData.SignedInBy) &&
          (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
        );
      }

      const attending = record.attending;
      incrementAttendanceCount(member, attending);
    });

    return Array.from(memberMap.values());
  }, [filteredAttendanceData, membersById]);

  const bulkOperationSummaryStats = useMemo(() => {
    const bulkData = applyFilters(attendanceData, attendanceFilters, sectionFilters, false);

    if (!bulkData || bulkData.length === 0) {
      return [];
    }

    const memberMap = new Map();

    bulkData.forEach((record) => {
      const key = record.scoutid;
      if (!memberMap.has(key)) {
        const memberData = membersById.get(String(record.scoutid));
        const personType = getPersonType(memberData, record);

        memberMap.set(key, {
          scoutid: record.scoutid,
          name: `${record.firstname} ${record.lastname}`,
          firstname: record.firstname,
          lastname: record.lastname,
          sectionid: record.sectionid,
          events: [],
          yes: 0,
          no: 0,
          invited: 0,
          notInvited: 0,
          vikingEventData: record.vikingEventData,
          isSignedIn: Boolean(
            record.vikingEventData?.SignedInBy &&
            !isFieldCleared(record.vikingEventData.SignedInBy) &&
            (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
          ),
          person_type: personType,
          patrol_id: memberData?.patrol_id,
          patrolid: memberData?.patrolid,
        });
      }

      const member = memberMap.get(key);
      member.events.push(record);

      // Fix: Ensure sectionid matches the record with actual sign-in data
      if (record.vikingEventData) {
        if (!member.vikingEventData) {
          member.sectionid = record.sectionid;  // Set section to match sign-in data
        }
        member.vikingEventData = record.vikingEventData;
        member.isSignedIn = Boolean(
          record.vikingEventData?.SignedInBy &&
          !isFieldCleared(record.vikingEventData.SignedInBy) &&
          (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
        );
      }

      const attending = record.attending;
      incrementAttendanceCount(member, attending);
    });

    return Array.from(memberMap.values());
  }, [attendanceData, attendanceFilters, sectionFilters, membersById]);

  const simplifiedSummaryStatsForOverview = useMemo(() => {
    const overviewData = applyFilters(attendanceData, attendanceFilters, sectionFilters, false);

    if (!overviewData || overviewData.length === 0) {
      return { sections: [], totals: null };
    }

    const sectionMap = new Map();

    // Create lookup from sectionid to actual section name from events
    const sectionIdToName = new Map();
    events.forEach((event) => {
      if (event.sectionid && event.sectionname) {
        sectionIdToName.set(event.sectionid, event.sectionname);
      }
    });

    // Create sections dynamically from attendance records only
    // This ensures we don't create duplicate sections when using shared attendance
    overviewData.forEach((record) => {
      if (!sectionMap.has(record.sectionid) && sectionFilters[record.sectionid] !== false) {
        const member = membersById.get(String(record.scoutid));
        const sectionName = sectionIdToName.get(record.sectionid) || record.sectionname || member?.sectionname || 'Unknown Section';

        sectionMap.set(record.sectionid, {
          name: sectionName,
          yes: { yp: 0, yl: 0, l: 0, total: 0 },
          no: { yp: 0, yl: 0, l: 0, total: 0 },
          invited: { yp: 0, yl: 0, l: 0, total: 0 },
          notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
          total: { yp: 0, yl: 0, l: 0, total: 0 },
        });
      }
    });

    overviewData.forEach((record) => {
      const section = sectionMap.get(record.sectionid);
      if (!section) return;

      const memberData = membersById.get(String(record.scoutid));
      const personType = getPersonType(memberData, record);

      let roleType = 'l';
      if (personType === 'Young People') {
        roleType = 'yp';
      } else if (personType === 'Young Leaders') {
        roleType = 'yl';
      } else if (personType === 'Leaders') {
        roleType = 'l';
      }

      // DEBUG: Log Explorers YL members
      if (section.name?.toLowerCase().includes('explorer') && roleType === 'yl') {
        const sectionMembership = memberData?.sections?.find(s => s.sectionid === record.sectionid);
        console.log('🔍 Explorers YL Member:', {
          scoutid: record.scoutid,
          name: `${record.firstname} ${record.lastname}`,
          recordSectionId: record.sectionid,
          sectionName: section.name,
          personType,
          roleType,
          sectionMembership: sectionMembership ? {
            sectionid: sectionMembership.sectionid,
            sectionname: sectionMembership.sectionname,
            person_type: sectionMembership.person_type,
          } : null,
          allSections: memberData?.sections?.map(s => ({
            sectionid: s.sectionid,
            sectionname: s.sectionname,
            person_type: s.person_type,
          })),
          topLevelPersonType: memberData?.person_type,
        });
      }

      const attending = record.attending;
      updateSectionCountsByAttendance(section, attending, roleType);
    });

    const sections = Array.from(sectionMap.values());

    const uniqueScouts = new Map();
    overviewData.forEach((record) => {
      const uniqueKey = `${record.scoutid}-${record.attending}`;

      if (!uniqueScouts.has(uniqueKey)) {
        const memberData = membersById.get(String(record.scoutid));
        const personType = getPersonType(memberData, record);

        let roleType = 'l';
        if (personType === 'Young People') {
          roleType = 'yp';
        } else if (personType === 'Young Leaders') {
          roleType = 'yl';
        } else if (personType === 'Leaders') {
          roleType = 'l';
        }

        uniqueScouts.set(uniqueKey, {
          attending: record.attending,
          roleType,
        });
      }
    });

    const totals = {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
      notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
      total: { yp: 0, yl: 0, l: 0, total: 0 },
    };

    uniqueScouts.forEach(({ attending, roleType }) => {
      if (attending === 'Yes') {
        totals.yes[roleType]++;
        totals.yes.total++;
        totals.total[roleType]++;
        totals.total.total++;
      } else if (attending === 'No') {
        totals.no[roleType]++;
        totals.no.total++;
        totals.total[roleType]++;
        totals.total.total++;
      } else if (attending === 'Invited') {
        totals.invited[roleType]++;
        totals.invited.total++;
        totals.total[roleType]++;
        totals.total.total++;
      } else if (attending === 'Not Invited') {
        totals.notInvited[roleType]++;
        totals.notInvited.total++;
        totals.total[roleType]++;
        totals.total.total++;
      }
    });

    return { sections, totals };
  }, [attendanceData, attendanceFilters, sectionFilters, uniqueSections, membersById, events]);

  const handleMemberClick = (member) => {
    const fullMemberData = members.find((m) => m.scoutid === member.scoutid);
    if (fullMemberData) {
      setSelectedMember(fullMemberData);
      setShowMemberModal(true);
    }
  };

  const handleResetFilters = () => {
    setAttendanceFilters({
      yes: true,
      no: false,
      invited: false,
      notInvited: false,
    });
    const allSectionsEnabled = {};
    uniqueSections.forEach((section) => {
      allSectionsEnabled[section.sectionid] = true;
    });
    setSectionFilters(allSectionsEnabled);
  };

  const handleClearSignInData = () => {
    setShowClearModal(true);
  };

  const handleCloseClearModal = () => {
    setShowClearModal(false);
  };
  const handleConfirmClearSignInData = async () => {
    const token = getToken();
    if (!token) {
      notifyError('Please sign in to OSM to clear sign-in data.');
      return;
    }

    setClearingSignInData(true);
    try {
      // Use clearEligibleMembers for consistency and avoid code duplication
      const clearEligibleMembers = bulkOperationSummaryStats.filter(member =>
        hasSignInData(member.vikingEventData),
      );

      // Build members by section using the eligible members
      const membersBySection = clearEligibleMembers.reduce((acc, member) => {
        const sectionId = member.sectionid;
        (acc[sectionId] ||= []).push(member);
        return acc;
      }, {});

      const totalMembers = clearEligibleMembers.length;

      if (totalMembers === 0) {
        notifyInfo('No sign-in data found to clear.');
        setShowClearModal(false);
        setClearingSignInData(false);
        return;
      }

      logger.info('Starting bulk clear sign-in data operation', {
        totalMembers,
        sectionCount: Object.keys(membersBySection).length,
      }, LOG_CATEGORIES.API);

      notifyInfo(`Clearing sign-in data for ${totalMembers} members across ${Object.keys(membersBySection).length} section(s)...`);

      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const [sectionId, members] of Object.entries(membersBySection)) {
        if (members.length === 0) continue;

        try {
          const event = events.find(e => String(e.sectionid) === String(sectionId));
          const termId = event?.termid || 'current';

          const vikingEventRecord = await getVikingEventFlexiRecord(sectionId, termId, token);

          if (!vikingEventRecord) {
            logger.warn('No Viking Event FlexiRecord found for bulk clear', { sectionId }, LOG_CATEGORIES.API);
            totalFailed += members.length;
            continue;
          }

          const flexiRecordContext = {
            flexirecordid: String(vikingEventRecord.extraid),
            sectionid: String(sectionId),
            termid: String(termId),
            sectiontype: 'Unknown Section Type',
            fieldMapping: vikingEventRecord.fieldMapping,
          };

          if (!flexiRecordContext) {
            logger.warn('No FlexiRecord context for section, skipping', { sectionId }, LOG_CATEGORIES.API);
            totalFailed += members.length;
            continue;
          }

          const scoutIds = members.map(member => member.scoutid);

          logger.info('Processing bulk sign-in data clear for section', {
            sectionId,
            memberCount: scoutIds.length,
          }, LOG_CATEGORIES.API);

          const clearResult = await bulkClearSignInData(scoutIds, flexiRecordContext, token);

          if (clearResult.success) {
            totalSuccessful += scoutIds.length;
            logger.info('Bulk sign-in data clear succeeded for section', {
              sectionId,
              clearedCount: scoutIds.length,
              clearedFields: clearResult.clearedFields,
              partial: clearResult.partial || false,
            }, LOG_CATEGORIES.API);

            if (clearResult.partial) {
              logger.warn('Partial success for section - some fields failed to clear', {
                sectionId,
                clearedFields: clearResult.clearedFields,
                failedFields: clearResult.failedFields,
              }, LOG_CATEGORIES.API);
            }
          } else {
            totalFailed += scoutIds.length;
            logger.warn('Bulk sign-in data clear failed for section', {
              sectionId,
              error: clearResult.error,
              failedCount: scoutIds.length,
            }, LOG_CATEGORIES.API);
          }

        } catch (sectionError) {
          logger.error('Failed to clear sign-in data for section', {
            sectionId,
            error: sectionError.message,
            memberCount: members.length,
          }, LOG_CATEGORIES.ERROR);
          totalFailed += members.length;
        }
      }

      if (totalFailed === 0) {
        notifySuccess(`Successfully cleared sign-in data for ${totalSuccessful} members`);

        if (loadVikingEventData) {
          try {
            await loadVikingEventData();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after clear operation', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else if (totalSuccessful > 0) {
        notifyWarning(`Sign-in data partially cleared: ${totalSuccessful} successful, ${totalFailed} failed`);

        if (loadVikingEventData) {
          try {
            await loadVikingEventData();
          } catch (refreshError) {
            logger.warn('Failed to refresh Viking Event data after partial clear operation', {
              error: refreshError.message,
            }, LOG_CATEGORIES.COMPONENT);
          }
        }
      } else {
        throw new Error(`Failed to clear sign-in data: no members were updated (${totalFailed} failures)`);
      }

    } catch (error) {
      logger.error('Failed to clear sign-in data', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      notifyError(`Failed to clear sign-in data: ${error.message}`);
    } finally {
      setClearingSignInData(false);
      setShowClearModal(false);
    }
  };

  // Manual attendance refresh handler following Task 2 SimpleAttendanceViewer pattern
  const handleRefreshAttendance = async () => {
    if (refreshingAttendance) return;

    try {
      setRefreshingAttendance(true);

      logger.info('Manual attendance refresh initiated from EventAttendance', {}, LOG_CATEGORIES.COMPONENT);

      const result = await eventDataLoader.syncAllEventAttendance(true);

      if (!result.success) {
        throw new Error(result.message);
      }

      setLastAttendanceRefresh(Date.now());

      logger.info('Attendance data synced successfully', {}, LOG_CATEGORIES.COMPONENT);

      notifySuccess('Attendance data synced successfully');

      if (loadVikingEventData) {
        try {
          await loadVikingEventData();
        } catch (vikingError) {
          logger.warn('Failed to refresh Viking Event data after attendance sync', {
            error: vikingError.message,
          }, LOG_CATEGORIES.COMPONENT);
        }
      }

      // Force re-render by triggering useAttendanceData hook
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      logger.error('Manual attendance refresh failed', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      notifyError(`Failed to refresh attendance: ${error.message}`);
    } finally {
      setRefreshingAttendance(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading attendance data..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="text-red-600">
            <h2 className="text-lg font-semibold mb-2">Error Loading Attendance</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
    case 'overview':
      return (
        <OverviewTab
          summaryStats={simplifiedSummaryStatsForOverview}
          members={members}
          onResetFilters={handleResetFilters}
          uniqueSections={uniqueSections}
        />
      );
      
    case 'register':
      return (
        <RegisterTab
          summaryStats={summaryStats}
          members={members}
          onSignInOut={handleSignInOut}
          buttonLoading={buttonLoading}
          onMemberClick={handleMemberClick}
          sortConfig={sortConfig}
          onSort={setSortConfig}
          onClearSignInData={handleClearSignInData}
          clearSignInDataLoading={clearingSignInData}
          onRefreshAttendance={handleRefreshAttendance}
          refreshAttendanceLoading={refreshingAttendance}
          lastRefreshTime={lastAttendanceRefresh}
        />
      );
      
    case 'detailed':
      return (
        <DetailedTab 
          summaryStats={summaryStats}
          members={members}
          onMemberClick={handleMemberClick}
          showContacts={dataFilters.contacts}
        />
      );
      
    case 'campGroups':
      return (
        <CampGroupsView 
          summaryStats={summaryStats}
          events={events}
          members={members}
          vikingEventData={vikingEventData}
          onMemberClick={handleMemberClick}
          onDataRefresh={loadVikingEventData}
        />
      );
      
    case 'sharedAttendance':
      if (loadingSharedAttendance) {
        return <LoadingScreen message="Loading shared attendance data..." />;
      }
      
      return (
        <div>
          {sharedAttendanceData && sharedAttendanceData.length > 0 ? (
            <div>
              {(() => {
                const isYoungPerson = (age) => {
                  if (!age) return true;

                  if (age === '25+') return false;

                  const match = age.match(/^(\d+)\s*\/\s*(\d+)$/);
                  if (match) {
                    const years = parseInt(match[1], 10);
                    return years < 18;
                  }

                  const singleMatch = age.match(/^(\d+)/);
                  if (singleMatch) {
                    const years = parseInt(singleMatch[1], 10);
                    return years < 18;
                  }

                  return true;
                };

                const getNumericAge = (age) => {
                  if (!age) return 0;
                  if (age === '25+') return 999;

                  const match = age.match(/^(\d+)\s*\/\s*(\d+)$/);
                  if (match) {
                    const years = parseInt(match[1], 10);
                    const months = parseInt(match[2], 10);
                    return years * 12 + months;
                  }

                  const singleMatch = age.match(/^(\d+)/);
                  return singleMatch
                    ? parseInt(singleMatch[1], 10) * 12
                    : 0;
                };

                const sectionGroups = {};
                let totalYoungPeople = 0;
                let totalAdults = 0;

                sharedAttendanceData.forEach((member) => {
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
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          All Sections ({sections.length})
                        </h3>
                        <div className="flex gap-2 text-sm text-gray-600">
                          <span>{totalMembers} total</span>
                          <span>•</span>
                          <span>{totalYoungPeople} YP</span>
                          <span>•</span>
                          <span>{totalAdults} adults</span>
                        </div>
                      </div>
                    </div>

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
            <div className="text-center py-8 text-gray-500">
              No shared attendance data available
            </div>
          )}
        </div>
      );
      
    default:
      return <div>Tab content not implemented yet</div>;
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <AttendanceHeader
            events={events}
            onBack={onBack}
            onRefresh={handleRefreshAttendance}
            canRefresh={true}
            refreshLoading={refreshingAttendance}
          />

          <div className="p-4">
            <AttendanceFilters
              attendanceFilters={attendanceFilters}
              onAttendanceFiltersChange={setAttendanceFilters}
              sectionFilters={sectionFilters}
              onSectionFiltersChange={setSectionFilters}
              sections={uniqueSections}
              showDataFilters={activeTab === 'detailed'}
              dataFilters={dataFilters}
              onDataFiltersChange={setDataFilters}
              attendanceData={attendanceData}
            />

            <AttendanceTabNavigation 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hasSharedEvents={hasSharedEvents}
            />

            {renderTabContent()}
          </div>
        </div>

        {selectedMember && (
          <MemberDetailModal
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            member={selectedMember}
          />
        )}

        <ClearSignInDataModal
          isOpen={showClearModal}
          onClose={handleCloseClearModal}
          onConfirm={handleConfirmClearSignInData}
          memberCount={bulkOperationSummaryStats.filter(member =>
            hasSignInData(member.vikingEventData),
          ).length}
          sectionCount={Object.keys(uniqueSections.reduce((acc, section) => {
            const hasSignInDataInSection = bulkOperationSummaryStats.some(member =>
              String(member.sectionid) === String(section.sectionid) &&
              hasSignInData(member.vikingEventData),
            );
            if (hasSignInDataInSection) {
              acc[section.sectionid] = true;
            }
            return acc;
          }, {})).length}
          loading={clearingSignInData}
        />
      </div>
    </div>
  );
}

export default EventAttendance;