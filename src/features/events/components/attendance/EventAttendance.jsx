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
import { checkAttendanceMatch } from '../../../../shared/utils/attendanceHelpers.js';

import AttendanceHeader from './AttendanceHeader.jsx';
import AttendanceFilters from './AttendanceFilters.jsx';
import AttendanceTabNavigation from './AttendanceTabNavigation.jsx';
import OverviewTab from './OverviewTab.jsx';
import RegisterTab from './RegisterTab.jsx';
import DetailedTab from './DetailedTab.jsx';

const hasSignInData = (vikingEventData) => {
  if (!vikingEventData) return false;

  return (
    (vikingEventData.SignedInBy && !isFieldCleared(vikingEventData.SignedInBy)) ||
    (vikingEventData.SignedInWhen && !isFieldCleared(vikingEventData.SignedInWhen)) ||
    (vikingEventData.SignedOutBy && !isFieldCleared(vikingEventData.SignedOutBy)) ||
    (vikingEventData.SignedOutWhen && !isFieldCleared(vikingEventData.SignedOutWhen))
  );
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

  const [activeTab, setActiveTab] = useState('overview');

  const {
    sharedAttendanceData: _sharedAttendanceDataFromHook,
    loadingSharedAttendance: _loadingSharedAttendance,
    hasSharedEvents: _hasSharedEvents,
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

  const [sectionFilters, setSectionFilters] = useState(() => {
    // Load saved section filters from localStorage
    try {
      const saved = localStorage.getItem('eventAttendance_sectionFilters');
      if (saved) {
        const savedFilters = JSON.parse(saved);
        // Merge with current sections (in case new sections were added)
        const filters = {};
        const uniqueSections = [...new Set(events.map((e) => e.sectionid))];
        uniqueSections.forEach((sectionId) => {
          // Use saved preference if available, otherwise default to true
          filters[sectionId] = savedFilters[sectionId] !== undefined ? savedFilters[sectionId] : true;
        });
        return filters;
      }
    } catch (error) {
    }

    // Default: all sections enabled
    const filters = {};
    const uniqueSections = [...new Set(events.map((e) => e.sectionid))];
    uniqueSections.forEach((sectionId) => {
      filters[sectionId] = true;
    });
    return filters;
  });

  useEffect(() => {
    try {
      localStorage.setItem('eventAttendance_sectionFilters', JSON.stringify(sectionFilters));
    } catch (error) {
    }
  }, [sectionFilters]);

  const uniqueSections = useMemo(() => {
    // Get section IDs from both events AND attendance data to include shared sections
    const eventSectionIds = new Set(events.map((e) => e.sectionid));
    const attendanceSectionIds = new Set(attendanceData.map((a) => a.sectionid));
    const allSectionIds = [...new Set([...eventSectionIds, ...attendanceSectionIds])];

    return allSectionIds.map((sectionId) => {
      // Try to get section name from events first
      const sectionEvent = events.find((e) => e.sectionid === sectionId);
      if (sectionEvent) {
        return {
          sectionid: sectionId,
          sectionname: sectionEvent.sectionname,
        };
      }

      // If not in events, get section name from attendance data
      const attendanceRecord = attendanceData.find((a) => a.sectionid === sectionId);
      const sectionName = attendanceRecord?.sectionname || `Section ${sectionId}`;

      return {
        sectionid: sectionId,
        sectionname: sectionName,
      };
    });
  }, [events, attendanceData]);



  // Pre-index core_members by scoutid for O(1) lookups
  const coreMembersById = useMemo(
    () => new Map(members.map(m => [String(m.scoutid), m])),
    [members],
  );

  // Pre-index member_section by scoutid+sectionid for O(1) lookups
  const memberSectionByKey = useMemo(() => {
    const map = new Map();
    members.forEach(m => {
      if (m.sections && Array.isArray(m.sections)) {
        m.sections.forEach(s => {
          const key = `${m.scoutid}_${s.sectionid}`;
          map.set(key, s);
        });
      }
    });
    return map;
  }, [members]);

  const enrichedAttendees = useMemo(() => {
    const memberMap = new Map();

    attendanceData.forEach((record) => {
      const key = `${record.scoutid}_${record.sectionid}`;

      if (!memberMap.has(key)) {
        const memberSection = memberSectionByKey.get(key);
        const coreMember = coreMembersById.get(String(record.scoutid)) || {};

        memberMap.set(key, {
          scoutid: record.scoutid,
          firstname: coreMember.firstname || record.firstname || '',
          lastname: coreMember.lastname || record.lastname || '',
          name: `${coreMember.firstname || record.firstname || ''} ${coreMember.lastname || record.lastname || ''}`,

          sectionid: record.sectionid,
          sectionname: memberSection?.sectionname || record.sectionname || '',

          yes: 0,
          no: 0,
          invited: 0,
          notInvited: 0,
          events: [],

          person_type: memberSection?.person_type || '',
          patrol_id: memberSection?.patrol_id,
          patrolid: memberSection?.patrol_id,

          vikingEventData: record.vikingEventData || {},
          isSignedIn: Boolean(
            record.vikingEventData?.SignedInBy &&
            !isFieldCleared(record.vikingEventData.SignedInBy) &&
            (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
          ),
        });
      }

      const memberEntry = memberMap.get(key);
      memberEntry.events.push(record);

      if (record.vikingEventData) {
        memberEntry.vikingEventData = record.vikingEventData;
        memberEntry.isSignedIn = Boolean(
          record.vikingEventData?.SignedInBy &&
          !isFieldCleared(record.vikingEventData.SignedInBy) &&
          (!record.vikingEventData?.SignedOutBy || isFieldCleared(record.vikingEventData.SignedOutBy)),
        );
      }

      const attending = record.attending;
      if (attending === 'Yes') {
        memberEntry.yes += 1;
      } else if (attending === 'No') {
        memberEntry.no += 1;
      } else if (attending === 'Invited') {
        memberEntry.invited += 1;
      } else if (attending === 'Not Invited') {
        memberEntry.notInvited += 1;
      }
    });

    return Array.from(memberMap.values());
  }, [attendanceData, coreMembersById, memberSectionByKey]);

  const checkMemberAttendanceMatch = (member, filters) => {
    if (!filters) return true;

    return (
      (filters.yes && member.yes > 0) ||
      (filters.no && member.no > 0) ||
      (filters.invited && member.invited > 0) ||
      (filters.notInvited && member.notInvited > 0)
    );
  };

  const registeredFilteredAttendees = useMemo(() =>
    enrichedAttendees.filter(member => {
      const sectionMatch = !sectionFilters || sectionFilters[member.sectionid];
      const statusMatch = checkMemberAttendanceMatch(member, attendanceFilters);
      return sectionMatch && statusMatch;
    }),
  [enrichedAttendees, sectionFilters, attendanceFilters],
  );

  const campGroupsFilteredAttendees = useMemo(() =>
    enrichedAttendees.filter(member =>
      !sectionFilters || sectionFilters[member.sectionid],
    ),
  [enrichedAttendees, sectionFilters],
  );

  const overviewStats = useMemo(() => {
    if (!enrichedAttendees || enrichedAttendees.length === 0) {
      return { sections: [], totals: null };
    }

    const sectionMap = new Map();
    const sectionIdToName = new Map();

    events.forEach((event) => {
      if (event.sectionid && event.sectionname) {
        sectionIdToName.set(event.sectionid, event.sectionname);
      }
    });

    enrichedAttendees.forEach((member) => {
      if (!sectionMap.has(member.sectionid)) {
        const sectionName = sectionIdToName.get(member.sectionid) || member.sectionname || 'Unknown Section';
        sectionMap.set(member.sectionid, {
          name: sectionName,
          yes: { yp: 0, yl: 0, l: 0, total: 0 },
          no: { yp: 0, yl: 0, l: 0, total: 0 },
          invited: { yp: 0, yl: 0, l: 0, total: 0 },
          notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
          total: { yp: 0, yl: 0, l: 0, total: 0 },
        });
      }

      const section = sectionMap.get(member.sectionid);
      if (!section) return;

      const personType = member.person_type;
      if (!personType) return;

      let roleType;
      if (personType === 'Young People') {
        roleType = 'yp';
      } else if (personType === 'Young Leaders') {
        roleType = 'yl';
      } else if (personType === 'Leaders') {
        roleType = 'l';
      }

      if (!roleType) return;

      section.yes[roleType] += member.yes || 0;
      section.yes.total += member.yes || 0;

      section.no[roleType] += member.no || 0;
      section.no.total += member.no || 0;

      section.invited[roleType] += member.invited || 0;
      section.invited.total += member.invited || 0;

      section.notInvited[roleType] += member.notInvited || 0;
      section.notInvited.total += member.notInvited || 0;

      const memberTotal = (member.yes || 0) + (member.no || 0) + (member.invited || 0) + (member.notInvited || 0);
      section.total[roleType] += memberTotal;
      section.total.total += memberTotal;
    });

    const sections = Array.from(sectionMap.values());

    const totals = {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
      notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
      total: { yp: 0, yl: 0, l: 0, total: 0 },
    };

    sections.forEach(section => {
      totals.yes.yp += section.yes.yp;
      totals.yes.yl += section.yes.yl;
      totals.yes.l += section.yes.l;
      totals.yes.total += section.yes.total;

      totals.no.yp += section.no.yp;
      totals.no.yl += section.no.yl;
      totals.no.l += section.no.l;
      totals.no.total += section.no.total;

      totals.invited.yp += section.invited.yp;
      totals.invited.yl += section.invited.yl;
      totals.invited.l += section.invited.l;
      totals.invited.total += section.invited.total;

      totals.notInvited.yp += section.notInvited.yp;
      totals.notInvited.yl += section.notInvited.yl;
      totals.notInvited.l += section.notInvited.l;
      totals.notInvited.total += section.notInvited.total;

      totals.total.yp += section.total.yp;
      totals.total.yl += section.total.yl;
      totals.total.l += section.total.l;
      totals.total.total += section.total.total;
    });

    return { sections, totals };
  }, [enrichedAttendees, events]);

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
      const clearEligibleMembers = campGroupsFilteredAttendees.filter(member =>
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

  if (loading && (!members || members.length === 0)) {
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
          attendees={overviewStats}
          members={members}
          onResetFilters={handleResetFilters}
          uniqueSections={uniqueSections}
        />
      );

    case 'register':
      return (
        <RegisterTab
          attendees={registeredFilteredAttendees}
          members={members}
          onSignInOut={handleSignInOut}
          buttonLoading={buttonLoading}
          onMemberClick={handleMemberClick}
          sortConfig={sortConfig}
          onSort={setSortConfig}
          onClearSignInData={handleClearSignInData}
          clearSignInDataLoading={clearingSignInData}
        />
      );

    case 'detailed':
      return (
        <DetailedTab
          attendees={registeredFilteredAttendees}
          members={members}
          onMemberClick={handleMemberClick}
          showContacts={dataFilters.contacts}
        />
      );

    case 'campGroups':
      return (
        <CampGroupsView
          attendees={campGroupsFilteredAttendees}
          events={events}
          members={members}
          vikingEventData={vikingEventData}
          onMemberClick={handleMemberClick}
          onDataRefresh={loadVikingEventData}
        />
      );
      
    case 'attendance':
      if (loading) {
        return <LoadingScreen message="Loading attendance data..." />;
      }

      return (
        <div>
          {attendanceData && attendanceData.length > 0 ? (
            <div>
              {(() => {
                const filteredData = attendanceData.filter((record) => {
                  const statusMatch = checkAttendanceMatch(record.attending, attendanceFilters);
                  const sectionMatch = !record.sectionid || sectionFilters[record.sectionid] === true;
                  return statusMatch && sectionMatch;
                });

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

                const sectionIdToName = new Map();
                events.forEach((event) => {
                  if (event.sectionid && event.sectionname) {
                    sectionIdToName.set(event.sectionid, event.sectionname);
                  }
                });

                const sectionGroups = {};
                let totalYoungPeople = 0;
                let totalAdults = 0;

                filteredData.forEach((record) => {
                  const memberData = coreMembersById.get(String(record.scoutid));
                  const sectionName = sectionIdToName.get(record.sectionid) || record.sectionname || memberData?.sectionname || 'Unknown Section';
                  const age = memberData?.age || record.age || 'N/A';

                  // Create enriched member object with all member data including consents
                  const member = {
                    ...memberData,
                    ...record,
                    sectionname: sectionName,
                    age: age,
                    firstname: record.firstname || memberData?.firstname,
                    lastname: record.lastname || memberData?.lastname,
                  };

                  const isYP = isYoungPerson(age);

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
                        onMemberClick={handleMemberClick}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No attendance data available
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

          {loading && members && members.length > 0 && (
            <div className="border-b border-gray-200 bg-blue-50 px-4 py-2">
              <div className="flex items-center text-sm text-blue-700">
                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing attendance data... (showing cached data)
              </div>
            </div>
          )}

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
          memberCount={campGroupsFilteredAttendees.filter(member =>
            hasSignInData(member.vikingEventData),
          ).length}
          sectionCount={Object.keys(uniqueSections.reduce((acc, section) => {
            const hasSignInDataInSection = campGroupsFilteredAttendees.some(member =>
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