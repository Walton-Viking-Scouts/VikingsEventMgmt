import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';

/**
 * One signup row: avatar, name, relative signup time, and — for plan editors —
 * a remove control that takes the person off this session.
 *
 * @param {Object} props
 * @param {{scoutid: string, name: string, photo_guid: string|null, at: string|null}} props.person - Signup entry
 * @param {Function} [props.onRemove] - Called with the person's scoutid to remove them; omitting hides the control
 * @param {boolean} [props.removing] - A remove write is in flight
 * @returns {JSX.Element} List row
 */
function SignupRow({ person, onRemove, removing = false }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <MemberAvatar
        member={{ scoutid: person.scoutid, photo_guid: person.photo_guid, name: person.name }}
        size="sm"
      />
      <span className="flex-1 text-sm font-medium text-gray-800">{person.name}</span>
      {person.at && (
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(parseISO(person.at), { addSuffix: true })}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          disabled={removing}
          onClick={() => onRemove(person.scoutid)}
          aria-label={`Remove ${person.name} from this session`}
          className="ml-1 h-6 w-6 rounded-full text-gray-400 hover:bg-gray-100 hover:text-scout-red disabled:opacity-50"
        >
          ×
        </button>
      )}
    </li>
  );
}

/**
 * Confirmed and backup signup lists for the session detail view.
 *
 * @param {Object} props
 * @param {import('../utils/rotaDisplay.js').SessionView} props.session - Resolved session view
 * @param {Function} [props.onRemove] - Plan-editor callback to remove a person (scoutid); omitting hides the controls
 * @param {string|number|null} [props.removingScoutid] - The scoutid whose remove write is in flight
 * @returns {JSX.Element} Signup lists
 */
function SignupList({ session, onRemove, removingScoutid = null }) {
  const { confirmed, backups, needed } = session;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">
        Confirmed{needed !== null && ` (${confirmed.length} of ${needed})`}
      </h3>
      {confirmed.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400 italic">Nobody yet</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {confirmed.map((person) => (
            <SignupRow
              key={person.scoutid}
              person={person}
              onRemove={onRemove}
              removing={String(removingScoutid) === String(person.scoutid)}
            />
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-sm font-semibold text-gray-700">
        Backup{backups.length > 0 && ` (${backups.length})`}
      </h3>
      {backups.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400 italic">Nobody on the backup list</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {backups.map((person) => (
            <SignupRow
              key={person.scoutid}
              person={person}
              onRemove={onRemove}
              removing={String(removingScoutid) === String(person.scoutid)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default SignupList;
