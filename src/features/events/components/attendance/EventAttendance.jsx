import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../../../shared/components/ui';
import LoadingScreen from '../../../../shared/components/LoadingScreen.jsx';
import MemberDetailModal from '../../../sections/components/MemberDetailModal.jsx';
import CampGroupsView from '../CampGroupsView.jsx';
import { useNotification } from '../../../../shared/contexts/notifications/NotificationContext';
import { useAttendanceData } from '../../hooks/useAttendanceData.js';
import { useSignInOut } from '../../../../shared/hooks/useSignInOut.js';

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


  const { notifyError, notifyWarning } = useNotification();

  const { buttonLoading, handleSignInOut } = useSignInOut(
    events,
    loadVikingEventData,
    { notifyError, notifyWarning },
  );

  const [filteredAttendanceData, setFilteredAttendanceData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
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

  const hasSharedEvents = useMemo(() => {
    return events.some(event => event.eventid?.toString()?.startsWith('shared_'));
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
  }, [filteredAttendanceData, uniqueSections, sectionFilters]);

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
        <Card className="p-6">
          <div className="text-red-600">
            <h2 className="text-lg font-semibold mb-2">Error Loading Attendance</h2>
            <p>{error}</p>
          </div>
        </Card>
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
            attendanceData={attendanceData}
            events={events}
            members={members}
            onBack={() => setActiveTab('overview')}
          />
        );
      
      default:
        return <div>Tab content not implemented yet</div>;
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <Card>
          <AttendanceHeader 
            events={events}
            onBack={onBack}
          />

          <Card.Body>
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
          </Card.Body>
        </Card>

        {selectedMember && (
          <MemberDetailModal
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            member={selectedMember}
            sectionsCache={sectionsCache}
          />
        )}
      </div>
    </div>
  );
}

export default EventAttendance;