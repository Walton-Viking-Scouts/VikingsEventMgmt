import React, { useState, useEffect } from 'react';
import { getEventAttendance } from '../services/api.js';
import { getToken } from '../services/auth.js';
import LoadingScreen from './LoadingScreen.jsx';

function AttendanceView({ events, onBack }) {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed

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
            token
          );
          
          if (attendance && attendance.items) {
            // Add event info to each attendance record
            const attendanceWithEvent = attendance.items.map(record => ({
              ...record,
              eventid: event.eventid,
              eventname: event.name,
              eventdate: event.startdate,
              sectionid: event.sectionid,
              sectionname: event.sectionname
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
          events: []
        };
      }
      
      memberStats[memberKey].total++;
      if (record.attending === '1' || record.attending === 'Yes') {
        memberStats[memberKey].attended++;
      }
      memberStats[memberKey].events.push({
        name: record.eventname,
        date: record.eventdate,
        attended: record.attending === '1' || record.attending === 'Yes'
      });
    });
    
    return Object.values(memberStats);
  };

  if (loading) {
    return <LoadingScreen message="Loading attendance..." />;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error Loading Attendance</h3>
        <p>{error}</p>
        <button 
          className="btn btn-primary mt-2"
          onClick={loadAttendance}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">No Attendance Data</h2>
          <button 
            className="btn btn-secondary"
            onClick={onBack}
            type="button"
          >
            Back to Events
          </button>
        </div>
        <p className="text-muted">
          No attendance data found for the selected event(s).
        </p>
      </div>
    );
  }

  const summaryStats = getSummaryStats();

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Attendance Data</h2>
        <div className="d-flex gap-2">
          <div className="badge badge-primary">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
          <button 
            className="btn btn-secondary"
            onClick={onBack}
            type="button"
          >
            Back
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="nav-tabs mb-3">
        <button 
          className={`nav-tab ${viewMode === 'summary' ? 'active' : ''}`}
          onClick={() => setViewMode('summary')}
          type="button"
        >
          Summary
        </button>
        <button 
          className={`nav-tab ${viewMode === 'detailed' ? 'active' : ''}`}
          onClick={() => setViewMode('detailed')}
          type="button"
        >
          Detailed
        </button>
      </div>

      {viewMode === 'summary' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Attended</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {summaryStats.map((member, index) => {
                const rate = member.total > 0 ? (member.attended / member.total * 100).toFixed(0) : 0;
                
                return (
                  <tr key={index}>
                    <td>
                      <div className="fw-bold">{member.name}</div>
                    </td>
                    <td>
                      {member.attended} / {member.total}
                    </td>
                    <td>
                      <span className={`badge ${rate >= 80 ? 'badge-success' : rate >= 60 ? 'badge-primary' : 'badge-danger'}`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'detailed' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Event</th>
                <th>Date</th>
                <th>Attended</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((record, index) => {
                const attended = record.attending === '1' || record.attending === 'Yes';
                
                return (
                  <tr key={index}>
                    <td>
                      <div className="fw-bold">{record.firstname} {record.lastname}</div>
                      <div className="text-muted">{record.sectionname}</div>
                    </td>
                    <td>{record.eventname}</td>
                    <td>{formatDate(record.eventdate)}</td>
                    <td>
                      <span className={`badge ${attended ? 'badge-success' : 'badge-danger'}`}>
                        {attended ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AttendanceView;