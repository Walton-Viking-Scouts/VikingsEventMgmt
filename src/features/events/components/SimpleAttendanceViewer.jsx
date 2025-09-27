import React, { useState, useEffect } from 'react';
import attendanceDataService from '../../../shared/services/data/attendanceDataService.js';
import Alert from '../../../shared/components/ui/Alert.jsx';
import { notifyError, notifySuccess, notifyInfo } from '../../../shared/utils/notifications.js';

function SimpleAttendanceViewer() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const loadAttendance = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await attendanceDataService.getAttendanceData(forceRefresh);
      setAttendanceData(data);
      setLastRefreshTime(attendanceDataService.getLastFetchTime());

      if (forceRefresh) {
        notifySuccess(`Refreshed attendance data - ${data.length} records loaded`);
      } else {
        notifyInfo(`Loaded attendance data - ${data.length} records`);
      }

    } catch (err) {
      setError(err.message);
      notifyError(`Failed to load attendance data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAttendance(true);
  };

  useEffect(() => {
    loadAttendance(false);
  }, []);

  const formatLastRefresh = () => {
    if (!lastRefreshTime) return 'Never';
    const now = new Date();
    const refreshTime = new Date(lastRefreshTime);
    const diffMinutes = Math.floor((now - refreshTime) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return refreshTime.toLocaleDateString();
  };

  const groupedByEvent = attendanceData.reduce((acc, record) => {
    const eventKey = `${record.eventid}-${record.eventname}`;
    if (!acc[eventKey]) {
      acc[eventKey] = {
        eventname: record.eventname,
        eventdate: record.eventdate,
        sectionname: record.sectionname,
        records: [],
      };
    }
    acc[eventKey].records.push(record);
    return acc;
  }, {});

  const getAttendanceStatusColor = (attending) => {
    switch (attending) {
    case 'Yes':
      return 'text-green-600 bg-green-50';
    case 'No':
      return 'text-red-600 bg-red-50';
    case 'Invited':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Attendance Viewer
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Simple view of attendance data with manual refresh
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-scout-blue hover:bg-scout-blue-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Last refreshed: {formatLastRefresh()}
              {attendanceData.length > 0 && (
                <span> • {attendanceData.length} records</span>
              )}
            </div>
          </div>

          <div className="p-4">
            {error && (
              <Alert variant="error" className="mb-4">
                <Alert.Title>Error Loading Data</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-scout-blue"></div>
                  <span className="text-sm text-gray-600">Loading attendance data...</span>
                </div>
              </div>
            )}

            {!loading && attendanceData.length === 0 && !error && (
              <Alert variant="info">
                <Alert.Title>No Data Available</Alert.Title>
                <Alert.Description>
                  No attendance data found. This could mean no events are cached or no attendance records exist.
                </Alert.Description>
              </Alert>
            )}

            {!loading && Object.keys(groupedByEvent).length > 0 && (
              <div className="space-y-6">
                {Object.entries(groupedByEvent).map(([eventKey, eventData]) => (
                  <div key={eventKey} className="border border-gray-200 rounded-lg">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900">{eventData.eventname}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <span>{eventData.sectionname}</span>
                        {eventData.eventdate && (
                          <span>• {new Date(eventData.eventdate).toLocaleDateString()}</span>
                        )}
                        <span>• {eventData.records.length} members</span>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {eventData.records.map((record) => (
                          <div
                            key={`${record.scoutid}-${record.eventid}`}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {record.firstname} {record.lastname}
                              </p>
                              <p className="text-xs text-gray-500">
                                ID: {record.scoutid}
                              </p>
                            </div>
                            <div className="ml-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAttendanceStatusColor(
                                  record.attending,
                                )}`}
                              >
                                {record.attending || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleAttendanceViewer;