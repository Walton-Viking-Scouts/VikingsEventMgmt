import React, { useState, useEffect, useMemo } from 'react';
import { SectionCardsFlexMasonry } from '../../../../shared/components/ui';
import LoadingScreen from '../../../../shared/components/LoadingScreen.jsx';
import { MemberDetailModal } from '../../../../shared/components/ui';
import CampGroupsView from '../CampGroupsView.jsx';
import { notifyError, notifyWarning } from '../../../../shared/utils/notifications.js';
import { useAttendanceData } from '../../hooks/useAttendanceData.js';
import { useSignInOut } from '../../../../shared/hooks/useSignInOut.js';
import { useSharedAttendance } from '../../hooks/useSharedAttendance.js';

import AttendanceHeader from './AttendanceHeader.jsx';
import AttendanceFilters from './AttendanceFilters.jsx';
import AttendanceTabNavigation from './AttendanceTabNavigation.jsx';
import OverviewTab from './OverviewTab.jsx';
import RegisterTab from './RegisterTab.jsx';
import DetailedTab from './DetailedTab.jsx';

function EventAttendance({ events, members, onBack }) {
  const {
    attendanceData,
    loading,
    error,
    loadVikingEventData,
  } = useAttendanceData(events);



  const { buttonLoading, handleSignInOut } = useSignInOut(
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

  // Debug the events being passed and shared events detection
  console.log('🐛 EventAttendance DEBUG:', {
    eventsCount: events?.length || 0,
    hasSharedEvents,
    eventDetails: events?.map(e => ({
      name: e.eventname,
      shared: e.shared,
      sharedType: typeof e.shared,
      allProperties: Object.keys(e),
    })) || [],
  });
  
  // Also log the full first event to see all available properties
  if (events?.length > 0) {
    console.log('🐛 FIRST EVENT FULL DATA:', events[0]);
    console.log('🐛 ALL EVENT PROPERTIES:', Object.keys(events[0]));
    console.log('🐛 LOOKING FOR SHARED PROPERTIES:', {
      shared: events[0].shared,
      isShared: events[0].isShared,
      shared_event: events[0].shared_event,
      sharedevent: events[0].sharedevent,
      is_shared: events[0].is_shared,
      sharedEvent: events[0].sharedEvent,
    });
  }
  const [sortConfig, setSortConfig] = useState({
    key: 'attendance',
    direction: 'desc',
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: true,
  });

  const [dataFilters, setDataFilters] = useState({
    contacts: false,
  });


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


  const applyFilters = (attendanceData, attendanceFilters, sectionFilters) => {
    if (!attendanceData || !Array.isArray(attendanceData)) return [];

    return attendanceData.filter((record) => {
      // Handle both string and number formats for attending field
      const attending = record.attending;
      const statusMatch = 
        ((attending === 1 || attending === 'Yes') && attendanceFilters.yes) ||
        ((attending === 0 || attending === 'No') && attendanceFilters.no) ||
        ((attending === 2 || attending === 'Invited') && attendanceFilters.invited) ||
        ((attending === 3 || attending === 'Not Invited') && attendanceFilters.notInvited);

      // For section filtering, skip if sectionid is missing (common in cached data)
      // The data should have sectionid added by the hook, but if not, allow it through
      const recordSectionId = record.sectionid;
      const sectionMatch = !recordSectionId || sectionFilters[recordSectionId] !== false;

      return statusMatch && sectionMatch;
    });
  };

  useEffect(() => {
    const filtered = applyFilters(attendanceData, attendanceFilters, sectionFilters);
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]);

  const summaryStats = useMemo(() => {
    if (!filteredAttendanceData || filteredAttendanceData.length === 0) {
      return [];
    }

    const memberMap = new Map();

    filteredAttendanceData.forEach((record) => {
      const key = record.scoutid;
      if (!memberMap.has(key)) {
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
          isSignedIn: Boolean(record.vikingEventData?.SignedInBy && !record.vikingEventData?.SignedOutBy),
        });
      }

      const member = memberMap.get(key);
      member.events.push(record);

      // Update vikingEventData if this record has more recent data
      if (record.vikingEventData) {
        member.vikingEventData = record.vikingEventData;
        // Update isSignedIn based on the latest vikingEventData
        member.isSignedIn = Boolean(record.vikingEventData?.SignedInBy && !record.vikingEventData?.SignedOutBy);
      }

      // Handle both string and number formats for attending field
      const attending = record.attending;
      if (attending === 1 || attending === 'Yes') member.yes++;
      else if (attending === 0 || attending === 'No') member.no++;
      else if (attending === 2 || attending === 'Invited') member.invited++;
      else if (attending === 3 || attending === 'Not Invited') member.notInvited++;
    });

    return Array.from(memberMap.values());
  }, [filteredAttendanceData]);

  const simplifiedSummaryStats = useMemo(() => {
    if (!filteredAttendanceData || filteredAttendanceData.length === 0) {
      return { sections: [], totals: null };
    }


    const sectionMap = new Map();
    
    uniqueSections.forEach(section => {
      if (sectionFilters[section.sectionid] !== false) {
        sectionMap.set(section.sectionid, {
          name: section.sectionname,
          yes: { yp: 0, yl: 0, l: 0, total: 0 },
          no: { yp: 0, yl: 0, l: 0, total: 0 },
          invited: { yp: 0, yl: 0, l: 0, total: 0 },
          notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
          total: { yp: 0, yl: 0, l: 0, total: 0 },
        });
      }
    });

    filteredAttendanceData.forEach((record) => {
      const section = sectionMap.get(record.sectionid);
      if (!section) return;

      // Find member data to get person_type for proper role categorization
      // Convert both scoutids to strings to handle type mismatch (attendance has strings, members has numbers)
      const memberData = members.find(m => m.scoutid.toString() === record.scoutid.toString());
      const personType = memberData?.person_type;
      
      // Map person_type to role abbreviations
      let roleType = 'l'; // default to Leaders
      if (personType === 'Young People') {
        roleType = 'yp';
      } else if (personType === 'Young Leaders') {
        roleType = 'yl';
      } else if (personType === 'Leaders') {
        roleType = 'l';
      }

      const updateCounts = (category) => {
        section[category][roleType]++;
        section[category].total++;
        section.total[roleType]++;
        section.total.total++;
      };

      // Handle both string and number formats for attending field
      const attending = record.attending;
      if (attending === 1 || attending === 'Yes') updateCounts('yes');
      else if (attending === 0 || attending === 'No') updateCounts('no');
      else if (attending === 2 || attending === 'Invited') updateCounts('invited');
      else if (attending === 3 || attending === 'Not Invited') updateCounts('notInvited');
    });

    const sections = Array.from(sectionMap.values());
    
    const totals = sections.reduce((acc, section) => {
      ['yes', 'no', 'invited', 'notInvited', 'total'].forEach(category => {
        acc[category].yp += section[category].yp;
        acc[category].yl += section[category].yl;
        acc[category].l += section[category].l;
        acc[category].total += section[category].total;
      });
      return acc;
    }, {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
      notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
      total: { yp: 0, yl: 0, l: 0, total: 0 },
    });

    return { sections, totals };
  }, [filteredAttendanceData, uniqueSections, sectionFilters, members]);

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
      no: true,
      invited: true,
      notInvited: true,
    });
    const allSectionsEnabled = {};
    uniqueSections.forEach((section) => {
      allSectionsEnabled[section.sectionid] = true;
    });
    setSectionFilters(allSectionsEnabled);
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
          summaryStats={simplifiedSummaryStats}
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
          onMemberClick={handleMemberClick}
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
      </div>
    </div>
  );
}

export default EventAttendance;