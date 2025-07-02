import React, { useState, useEffect } from 'react';
import { getEventAttendance } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';
import { Card, Button, Badge, Alert } from './ui';

function AttendanceView({ events, onBack }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
          
          if (attendance && attendance.items) {
            // Add event info to each attendance record
            const attendanceWithEvent = attendance.items.map(record => ({
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

  const getSummaryStats = () => {
    const memberStats = {};
    
    attendanceData.forEach(record => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          attended: 0,
          total: 0,
          events: [],
        };
      }
      
      memberStats[memberKey].total++;
      if (record.attending === '1' || record.attending === 'Yes') {
        memberStats[memberKey].attended++;
      }
      memberStats[memberKey].events.push({
        name: record.eventname,
        date: record.eventdate,
        attended: record.attending === '1' || record.attending === 'Yes',
      });
    });
    
    return Object.values(memberStats);
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
          aValue = a.attended || 0;
          bValue = b.attended || 0;
        } else {
          aValue = (a.attending === '1' || a.attending === 'Yes') ? 1 : 0;
          bValue = (b.attending === '1' || b.attending === 'Yes') ? 1 : 0;
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

  return (
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
              {sortData(summaryStats, sortConfig.key, sortConfig.direction).map((member, index) => {
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {member.attended} / {member.total}
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
                const attended = record.attending === '1' || record.attending === 'Yes';
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{record.firstname} {record.lastname}</div>
                      <div className="text-gray-500 text-sm">{record.sectionname}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {record.eventname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {formatDate(record.eventdate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={attended ? 'scout-green' : 'scout-red'}>
                        {attended ? 'Yes' : 'No'}
                      </Badge>
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
  );
}

export default AttendanceView;
