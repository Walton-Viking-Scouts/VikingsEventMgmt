import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EventAttendance } from './attendance/index.js';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import { fetchAllSectionEvents } from '../../../shared/utils/eventDashboardHelpers.js';
import { notifyWarning } from '../../../shared/utils/notifications.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

/**
 * URL-routed attendance view: /events/:eventName/attendance/:tab?
 *
 * Loads its own event group and members from the local cache by event name,
 * so the view survives page reloads, iOS webview restarts, and back-swipe,
 * and can be deep-linked/shared — state-based navigation lost all of that.
 */
function EventAttendancePage() {
  const { eventName, tab } = useParams();
  const navigate = useNavigate();
  // Guarded: a hand-edited or truncated deep link with malformed percent-
  // encoding must land on the not-found redirect, not throw during render.
  let decodedName = eventName || '';
  try {
    decodedName = decodeURIComponent(eventName || '');
  } catch {
    // keep the raw segment; the no-events-found path below handles it
  }

  const [events, setEvents] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const sections = await databaseService.getSections();
        const allEvents = await fetchAllSectionEvents(sections);
        const groupEvents = allEvents
          .filter(e => e.name === decodedName)
          .sort((a, b) => new Date(a.startdate) - new Date(b.startdate));

        if (!mounted) return;

        if (groupEvents.length === 0) {
          logger.warn('No cached events found for attendance URL', {
            eventName: decodedName,
          }, LOG_CATEGORIES.COMPONENT);
          notifyWarning(`No cached data for "${decodedName}". Sync from the dashboard first.`);
          navigate('/events', { replace: true });
          return;
        }

        const sectionIds = [...new Set(groupEvents.map(e => e.sectionid))];
        let membersData = [];
        try {
          membersData = await databaseService.getMembers(sectionIds);
        } catch (memberError) {
          logger.warn('Could not load cached members for attendance view', {
            error: memberError.message,
          }, LOG_CATEGORIES.COMPONENT);
          notifyWarning('Member details unavailable - showing attendance only.');
        }

        if (!mounted) return;
        setMembers(membersData || []);
        setEvents(groupEvents);
      } catch (error) {
        logger.error('Failed to load attendance view data', {
          eventName: decodedName,
          error: error.message,
        }, LOG_CATEGORIES.ERROR);
        if (mounted) {
          notifyWarning('Unable to load event data. Returning to dashboard.');
          navigate('/events', { replace: true });
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [decodedName, navigate]);

  if (!events) {
    return <LoadingScreen message="Loading event..." />;
  }

  return (
    <EventAttendance
      events={events}
      members={members}
      onBack={() => navigate('/events')}
      activeTab={tab || 'overview'}
      onTabChange={(nextTab) => navigate(`/events/${encodeURIComponent(decodedName)}/attendance/${nextTab}`)}
    />
  );
}

export default EventAttendancePage;
