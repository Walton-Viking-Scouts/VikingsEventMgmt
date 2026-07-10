import React from 'react';
import { format, parseISO } from 'date-fns';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';
import { coverStatusBgClass, sectionChipClass, COVER_STATUS } from '../utils/rotaDisplay.js';
import SignupButtons from './SignupButtons.jsx';

const MAX_AVATARS = 4;

/**
 * One session on the rota board: cover-status rail, section chip, date and
 * times, activity, expected young people, the permit-holder cover line with
 * an overlapping avatar cluster (backups get a dashed ring), and — when a
 * signup handler is provided — one-tap signup pills.
 *
 * @param {Object} props
 * @param {import('../utils/rotaDisplay.js').SessionView} props.session - Resolved session view model
 * @param {Function} [props.onSelect] - Called with the session when the card body is tapped
 * @param {string|null} [props.myStatus] - Current user's signup for this session ('I', 'B', or null)
 * @param {Function} [props.onSignupChange] - Called with (session, newStatus); omitting hides the pills
 * @param {boolean} [props.signupDisabled] - Disable the pills (offline / identity unresolved)
 * @param {boolean} [props.signupPending] - A signup write is in flight for this session
 * @returns {JSX.Element} Session card
 */
function SessionCard({
  session,
  onSelect,
  myStatus = null,
  onSignupChange,
  signupDisabled = false,
  signupPending = false,
}) {
  const {
    date,
    sectionName,
    activity,
    startTime,
    endTime,
    kids,
    needed,
    cancelled,
    hasMeta,
    confirmed,
    backups,
    status,
  } = session;

  const people = [...confirmed, ...backups];
  const overflow = people.length - MAX_AVATARS;
  const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : startTime || '';
  const showSignup = Boolean(onSignupChange) && !cancelled;

  return (
    <div
      data-testid={`session-${session.fieldId}`}
      className={`relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
        cancelled ? 'opacity-60' : ''
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${coverStatusBgClass(status)}`} aria-hidden="true" />

      <button
        type="button"
        onClick={() => onSelect?.(session)}
        className="block w-full text-left pl-4 pr-3 pt-3 pb-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-scout-blue"
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sectionChipClass(sectionName)}`}>
            {sectionName}
          </span>
          <span className={`text-sm font-medium text-gray-900 ${cancelled ? 'line-through' : ''}`}>
            {format(parseISO(date), 'EEE d MMM')}
          </span>
          {timeLabel && (
            <span className="text-sm text-gray-500">{timeLabel}</span>
          )}
          {cancelled && (
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Not on water
            </span>
          )}
        </span>

        {!cancelled && (
          <span className="mt-1 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {activity || 'Activity not set'}
            </span>
            {kids !== null && (
              <span className="text-xs text-gray-500">~{kids} YP</span>
            )}
          </span>
        )}

        {!cancelled && (
          <span className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              {status === COVER_STATUS.UNSET && !hasMeta ? (
                <span className="text-gray-400 italic">Needs setting up</span>
              ) : needed === null ? (
                <span className="text-gray-400 italic">Permit holders not set</span>
              ) : (
                <>
                  <span className="font-semibold">{confirmed.length}</span>
                  {` of ${needed} permit holder${needed === 1 ? '' : 's'}`}
                  {backups.length > 0 && (
                    <span className="text-gray-500">{` · ${backups.length} backup${backups.length === 1 ? '' : 's'}`}</span>
                  )}
                </>
              )}
            </span>

            {people.length > 0 && (
              <span className="flex -space-x-2" aria-label={`Signed up: ${people.map((p) => p.name).join(', ')}`}>
                {people.slice(0, MAX_AVATARS).map((person) => (
                  <span
                    key={person.scoutid}
                    className={`inline-block rounded-full ring-2 ${
                      person.status === 'B' ? 'ring-gray-400 ring-dashed' : 'ring-white'
                    }`}
                  >
                    <MemberAvatar member={{ name: person.name }} size="sm" />
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center ring-2 ring-white">
                    +{overflow}
                  </span>
                )}
              </span>
            )}
          </span>
        )}
      </button>

      {showSignup && (
        <div className="pl-4 pr-3 pb-3">
          <SignupButtons
            myStatus={myStatus}
            disabled={signupDisabled || signupPending}
            pending={signupPending}
            onChange={(newStatus) => onSignupChange(session, newStatus)}
          />
        </div>
      )}
    </div>
  );
}

export default SessionCard;
