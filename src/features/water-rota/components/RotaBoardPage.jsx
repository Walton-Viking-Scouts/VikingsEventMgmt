import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import SectionFilter from '../../../shared/components/ui/SectionFilter.jsx';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { useWaterRota } from '../hooks/useWaterRota.js';
import { resolveAllSessions } from '../utils/rotaDisplay.js';
import { bucketSessionsByWeek, startOfIsoWeek } from '../utils/rotaDates.js';
import SessionCard from './SessionCard.jsx';
import TermOverviewStrip from './TermOverviewStrip.jsx';

const FILTERS_STORAGE_KEY = 'viking_water_rota_section_filters';

/**
 * Read persisted section filters, defaulting to everything visible.
 *
 * @returns {Object} Map of sectionId to boolean visibility
 */
function readStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * The rota board: term overview strip plus a week-bucketed session list.
 * Auto-scrolls to the current week on load. Renders empty/error/first-run
 * states when there is no rota for the year.
 *
 * @param {Object} props
 * @param {Function} [props.onSelectSession] - Called with a session view when a card is tapped
 * @returns {JSX.Element} Board page
 */
function RotaBoardPage({ onSelectSession }) {
  const navigate = useNavigate();
  const { loading, rota, error, refresh, year } = useWaterRota();
  const [sectionFilters, setSectionFilters] = useState(readStoredFilters);
  const weekRefs = useRef(new Map());
  const didAutoScroll = useRef(false);

  const sessions = useMemo(() => (rota ? resolveAllSessions(rota) : []), [rota]);

  const filterSections = useMemo(
    () =>
      (rota?.config?.cfg?.sections ?? []).map((entry) => ({
        sectionid: entry.sid,
        sectionname: entry.sname,
      })),
    [rota],
  );

  const visibleSessions = useMemo(
    () => sessions.filter((session) => sectionFilters[session.sectionId] !== false),
    [sessions, sectionFilters],
  );

  const weeks = useMemo(() => bucketSessionsByWeek(visibleSessions), [visibleSessions]);
  const currentWeekStart = startOfIsoWeek(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (didAutoScroll.current || weeks.length === 0) {
      return;
    }
    const target = weeks.find((week) => week.weekStart >= currentWeekStart) ?? weeks[weeks.length - 1];
    weekRefs.current.get(target.weekStart)?.scrollIntoView({ block: 'start' });
    didAutoScroll.current = true;
  }, [weeks, currentWeekStart]);

  const handleFiltersChange = (filters) => {
    setSectionFilters(filters);
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* non-fatal: filters just won't persist */
    }
  };

  const scrollToWeek = (weekStart) => {
    weekRefs.current.get(weekStart)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <LoadingScreen message="Loading water rota..." />;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-gray-700 font-medium">Couldn&apos;t load the water rota</p>
        <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 px-4 py-2 rounded-md bg-scout-blue text-white text-sm font-medium hover:bg-scout-blue-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl" aria-hidden="true">🛶</div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          No water rota for {year} yet
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Set up this summer&apos;s on-water sessions from each section&apos;s programme, then
          permit holders can sign up to cover them.
        </p>
        <button
          type="button"
          onClick={() => navigate('/water-rota/setup')}
          className="mt-6 px-5 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark"
        >
          Set up the rota
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900">Water Rota {year}</h1>
        <button
          type="button"
          onClick={refresh}
          className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium"
        >
          Refresh
        </button>
      </div>

      {filterSections.length > 1 && (
        <div className="mt-3">
          <SectionFilter
            sections={filterSections}
            sectionFilters={sectionFilters}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      )}

      <div className="mt-3 sticky top-0 z-10 bg-white/95 backdrop-blur rounded-lg">
        <TermOverviewStrip
          weeks={weeks}
          currentWeekStart={currentWeekStart}
          onSelectWeek={scrollToWeek}
        />
      </div>

      {weeks.length === 0 ? (
        <p className="mt-8 text-center text-sm text-gray-500">
          No sessions match the current filters.
        </p>
      ) : (
        <div className="mt-2 space-y-6 pb-12">
          {weeks.map(({ weekStart, sessions: weekSessions }) => (
            <section
              key={weekStart}
              ref={(node) => {
                if (node) {
                  weekRefs.current.set(weekStart, node);
                } else {
                  weekRefs.current.delete(weekStart);
                }
              }}
              aria-label={`Week of ${format(parseISO(weekStart), 'd MMMM yyyy')}`}
            >
              <h2 className={`text-sm font-semibold py-1.5 ${
                weekStart === currentWeekStart ? 'text-scout-blue' : 'text-gray-500'
              }`}>
                Week of {format(parseISO(weekStart), 'd MMMM')}
                {weekStart === currentWeekStart && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide">this week</span>
                )}
              </h2>
              <div className="space-y-2">
                {weekSessions.map((session) => (
                  <SessionCard key={session.fieldId} session={session} onSelect={onSelectSession} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default RotaBoardPage;
