import React from 'react';
import { format, parseISO } from 'date-fns';
import { coverStatusBgClass } from '../utils/rotaDisplay.js';

/**
 * Horizontally scrollable term overview: one narrow column per week, one
 * status dot per session. The whole-term "do I have enough cover" answer
 * in a glance; tapping a week scrolls the board to it.
 *
 * @param {Object} props
 * @param {Array<{weekStart: string, sessions: Array}>} props.weeks - Week buckets of resolved session views
 * @param {string} props.currentWeekStart - Monday of the current week (yyyy-mm-dd)
 * @param {Function} [props.onSelectWeek] - Called with a weekStart when tapped
 * @returns {JSX.Element|null} Strip, or null with no weeks
 */
function TermOverviewStrip({ weeks, currentWeekStart, onSelectWeek }) {
  if (!weeks || weeks.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto pb-1" role="navigation" aria-label="Term overview">
      <div className="flex gap-1.5 min-w-max px-1">
        {weeks.map(({ weekStart, sessions }) => {
          const isCurrent = weekStart === currentWeekStart;
          return (
            <button
              key={weekStart}
              type="button"
              onClick={() => onSelectWeek?.(weekStart)}
              aria-label={`Week of ${format(parseISO(weekStart), 'd MMMM')}`}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border ${
                isCurrent
                  ? 'border-scout-blue bg-scout-blue/5'
                  : 'border-transparent hover:bg-gray-100'
              }`}
            >
              <span className={`text-[11px] font-medium whitespace-nowrap ${isCurrent ? 'text-scout-blue' : 'text-gray-500'}`}>
                {format(parseISO(weekStart), 'd MMM')}
              </span>
              <span className="flex gap-1">
                {sessions.map((session) => (
                  <span
                    key={session.key}
                    className={`h-2.5 w-2.5 rounded-full ${coverStatusBgClass(session.status)} ${
                      session.cancelled ? 'opacity-40' : ''
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TermOverviewStrip;
