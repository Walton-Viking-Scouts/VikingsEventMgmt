/**
 * Examples of how components use the simplified data loading
 *
 * BEFORE vs AFTER comparison showing the reduction in complexity
 */

import React from 'react';
import { usePageData, useEventDetailData } from '../shared/hooks/usePageData.js';

// ========================================
// BEFORE (Complex sync service usage)
// ========================================

/*
const EventsPageOLD = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [events, setEvents] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Complex sync orchestration
    const syncService = new SyncService();

    syncService.addSyncListener((status) => {
      setSyncStatus(status);
      if (status.status === 'dashboard_complete') {
        // Now manually load events for each section...
        loadEventsForAllSections();
      }
      if (status.status === 'error') {
        setError(status.message);
      }
    });

    const loadData = async () => {
      try {
        await syncService.syncDashboardData();
        // More complex state management...
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadEventsForAllSections = async () => {
    // Complex logic with rate limiting, error handling, etc.
    // 50+ lines of code...
  };

  const handleRefresh = async () => {
    // Complex refresh logic...
  };

  // Complex render logic with multiple loading states...
};
*/

// ========================================
// AFTER (Simple usePageData hook)
// ========================================

/**
 * Events Page - Simplified Usage
 * One hook, three return values, done!
 */
const EventsPageNEW = () => {
  const { data, loading, error, refresh } = usePageData('events');

  if (loading) return <LoadingScreen message="Loading events..." />;
  if (error) return <ErrorScreen error={error} onRetry={refresh} />;
  if (!data) return <EmptyState />;

  const { sections, events } = data;

  return (
    <div>
      <header>
        <h1>Events</h1>
        <button onClick={refresh}>Refresh</button>
      </header>

      {sections.map(section => (
        <SectionEventCard
          key={section.sectionid}
          section={section}
          events={events[section.sectionid] || []}
        />
      ))}
    </div>
  );
};

/**
 * Sections Page - Different Data, Same Pattern
 * No events data loaded (more efficient)
 */
const SectionsPageNEW = () => {
  const { data, loading, error, refresh } = usePageData('sections');

  if (loading) return <LoadingScreen message="Loading sections..." />;
  if (error) return <ErrorScreen error={error} onRetry={refresh} />;

  const { sections, members } = data;

  return (
    <div>
      <h1>Sections</h1>
      {sections.map(section => (
        <SectionCard
          key={section.sectionid}
          section={section}
          members={members[section.sectionid] || []}
        />
      ))}
    </div>
  );
};

/**
 * Event Detail Modal - Drill-down Data
 * Separate hook for drill-down scenarios
 */
const EventDetailModalNEW = ({ eventId, sectionId, onClose }) => {
  const { data, loading, error } = useEventDetailData(eventId, sectionId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  const { attendance, members } = data;

  return (
    <div className="modal">
      <header>
        <h2>Event Details</h2>
        <button onClick={onClose}>×</button>
      </header>

      <AttendanceGrid
        attendance={attendance}
        members={members}
      />

      {/* FlexiRecord components will be added separately */}
      {/* <CampGroupsView /> */}
      {/* <SignInOutButtons /> */}
    </div>
  );
};

// ========================================
// COMPARISON SUMMARY
// ========================================

/*
BEFORE:
- 100+ lines of sync orchestration code per page
- Complex state management with multiple useState calls
- Manual error handling for each data type
- Complex refresh logic
- Tight coupling to sync service internals

AFTER:
- 1 line: usePageData('events')
- Simple destructuring: { data, loading, error, refresh }
- Automatic error handling and caching
- One-line refresh: refresh()
- Clean separation of concerns

BENEFITS:
✅ 90% reduction in component code
✅ Consistent loading/error patterns
✅ Automatic caching with offline support
✅ Rate limiting protection maintained
✅ Page-specific data loading (no unnecessary API calls)
✅ Simple refresh functionality
✅ Easy testing and debugging
*/

export { EventsPageNEW, SectionsPageNEW, EventDetailModalNEW };