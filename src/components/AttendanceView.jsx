import React, { useState, useEffect } from 'react';
import { getEventAttendance } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import { Card, Button, Badge, Alert } from './ui';

function AttendanceView({ events, members, onBack }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  useEffect(() => {
    loadAttendance();
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      const allAttendance = [];
      
      // Load attendance for each selected event
      for (const event of events) {
        try {
          const attendance = await getEventAttendance(
            event.sectionid, 
            event.eventid, 
            event.termid, 
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
        } catch (eventError) {
          console.warn(`Error loading attendance for event ${event.name}:`, eventError);
        }
      }
      
      setAttendanceData(allAttendance);
      
    } catch (err) {
      console.error('Error loading attendance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getAttendanceStatus = (attending) => {
    if (attending === 'Yes' || attending === '1') return 'yes';
    if (attending === 'Invited') return 'invited';
    return 'no'; // For empty string, "No", or other values
  };

  const getSummaryStats = () => {
    const memberStats = {};
    
    attendanceData.forEach(record => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          yes: 0,
          no: 0,
          invited: 0,
          total: 0,
          events: [],
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
      });
    });
    
    return Object.values(memberStats);
  };


  const getSimplifiedAttendanceSummaryStats = () => {
    const sectionStats = {};
    const totals = {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
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
          aValue = a.yes || 0;
          bValue = b.yes || 0;
        } else {
          const statusA = getAttendanceStatus(a.attending);
          const statusB = getAttendanceStatus(b.attending);
          // Sort order: yes, invited, no
          const statusOrder = { yes: 0, invited: 1, no: 2 };
          aValue = statusOrder[statusA] || 3;
          bValue = statusOrder[statusB] || 3;
        }
        break;
      case 'event':
        aValue = a.eventname?.toLowerCase() || '';
        bValue = b.eventname?.toLowerCase() || '';
        break;
      case 'date':
        aValue = new Date(a.eventdate || '1900-01-01');
        bValue = new Date(b.eventdate || '1900-01-01');
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
            Back to Events
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
                    <th className="px-2 py-2 text-center table-header-text text-blue-600 uppercase tracking-wider">
                      <div>Invited</div>
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
                      <td className="px-2 py-3 whitespace-nowrap text-center text-blue-600 font-semibold">
                        <div className="flex justify-center">
                          <span className="w-8 text-center">{section.invited.yp}</span>
                          <span className="w-8 text-center">{section.invited.yl}</span>
                          <span className="w-8 text-center">{section.invited.l}</span>
                          <span className="w-12 text-center">{section.invited.total}</span>
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
                    <td className="px-2 py-3 whitespace-nowrap text-center text-blue-600 font-bold border-t-2 border-gray-300">
                      <div className="flex justify-center">
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.yp}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.yl}</span>
                        <span className="w-8 text-center">{simplifiedSummaryStats.totals.invited.l}</span>
                        <span className="w-12 text-center">{simplifiedSummaryStats.totals.invited.total}</span>
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
          <Card.Title>Attendance Data</Card.Title>
          <div className="flex gap-2 items-center">
            <Badge variant="scout-blue">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
            <Button 
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
            >
            Back
            </Button>
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
            </nav>
          </div>

          {viewMode === 'summary' && (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance Status
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
                              Yes: {member.yes}
                              </Badge>
                            )}
                            {member.no > 0 && (
                              <Badge variant="scout-red" className="text-xs">
                              No: {member.no}
                              </Badge>
                            )}
                            {member.invited > 0 && (
                              <Badge variant="scout-blue" className="text-xs">
                              Invited: {member.invited}
                              </Badge>
                            )}
                          </div>
                          <div className="text-gray-500 text-sm mt-1">
                          Total events: {member.total}
                          </div>
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
                      onClick={() => handleSort('event')}
                    >
                      <div className="flex items-center">
                    Event {getSortIcon('event')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center">
                    Date {getSortIcon('date')}
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
                  {sortData(attendanceData, sortConfig.key, sortConfig.direction).map((record, index) => {
                    const status = getAttendanceStatus(record.attending);
                    let badgeVariant, statusText;
                  
                    switch (status) {
                    case 'yes':
                      badgeVariant = 'scout-green';
                      statusText = 'Yes';
                      break;
                    case 'invited':
                      badgeVariant = 'scout-blue';
                      statusText = 'Invited';
                      break;
                    default:
                      badgeVariant = 'scout-red';
                      statusText = 'No';
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
                          <div className="text-gray-500 text-sm">{record.sectionname}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          {record.eventname}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          {formatDate(record.eventdate)}
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
