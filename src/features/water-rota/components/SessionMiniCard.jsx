import React from 'react';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';
import { COVER_STATUS, coverStatusTintClass, sectionChipClass } from '../utils/rotaDisplay.js';

const MAX_AVATARS = 3;

/**
 * Compact tappable board tile for one session: section chip and activity,
 * a prominent cover ratio, and an overlapping avatar cluster (backups get a
 * dashed ring). Signup lives in the session detail modal, not here — tapping
 * the card just opens it.
 *
 * @param {Object} props
 * @param {import('../utils/rotaDisplay.js').SessionView} props.session - Resolved session view model
 * @param {Function} props.onSelect - Called with the session when the tile is tapped
 * @returns {JSX.Element} Mini card
 */
function SessionMiniCard({ session, onSelect }) {
  const { sectionName, activity, needed, cancelled, hasMeta, confirmed, backups, status } = session;
  const people = [...confirmed, ...backups];
  const overflow = people.length - MAX_AVATARS;

  let ratioLabel;
  if (cancelled) {
    ratioLabel = 'Not on water';
  } else if (status === COVER_STATUS.UNSET && !hasMeta) {
    ratioLabel = 'Set up';
  } else if (needed === null) {
    ratioLabel = '—';
  } else {
    ratioLabel = `${confirmed.length}/${needed}`;
  }
  // Dead (not-on-water / not-yet-set-up) sessions recede so the eye lands on
  // live cover ratios that actually need permit holders.
  const ratioMuted = cancelled || (status === COVER_STATUS.UNSET && !hasMeta);

  return (
    <button
      type="button"
      data-testid={`minicard-${session.key}`}
      onClick={() => onSelect(session)}
      className={`w-44 min-w-[11rem] rounded-lg border p-2.5 text-left ${coverStatusTintClass(status)} ${
        cancelled ? 'opacity-70' : ''
      }`}
    >
      <span className={`block truncate px-2 py-0.5 rounded-full text-xs font-semibold text-center ${sectionChipClass(sectionName)}`}>
        {sectionName}
      </span>
      <span className="mt-1 block truncate text-xs text-gray-600">{activity || 'Activity not set'}</span>

      <span className={`mt-1 block ${ratioMuted ? 'text-sm font-medium text-gray-400' : 'text-lg font-bold text-gray-900'}`}>
        {ratioLabel}
      </span>

      {people.length > 0 && (
        <span className="mt-1.5 flex -space-x-3" aria-label={`Signed up: ${people.map((p) => p.name).join(', ')}`}>
          {people.slice(0, MAX_AVATARS).map((person) => (
            <span
              key={person.scoutid}
              className={`inline-block rounded-full ring-2 ${
                person.status === 'B' ? 'ring-gray-400 ring-dashed' : 'ring-white'
              }`}
            >
              <MemberAvatar
                member={{ scoutid: person.scoutid, photo_guid: person.photo_guid, name: person.name }}
                size="md"
              />
            </span>
          ))}
          {overflow > 0 && (
            <span className="h-12 w-12 rounded-full bg-gray-200 text-gray-700 text-sm font-medium flex items-center justify-center ring-2 ring-white">
              +{overflow}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export default SessionMiniCard;
