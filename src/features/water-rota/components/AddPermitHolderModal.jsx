import React, { useMemo, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal.jsx';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';

/**
 * Searchable host-member picker so a leader can add a permit holder they
 * know is coming, without waiting for that member to self-signup. Members
 * already on the session (confirmed or backup) are shown but disabled.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is shown
 * @param {Array<{scoutid: string, name: string, photo_guid: string|null}>} props.members - Host-section member rows
 * @param {Array<string>} props.existingScoutids - Scoutids already signed up (confirmed or backup)
 * @param {Function} props.onPick - Called with the chosen scoutid
 * @param {Function} props.onClose - Dismiss without choosing
 * @returns {JSX.Element} Add permit holder modal
 */
function AddPermitHolderModal({ isOpen, members, existingScoutids, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...(members ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return needle
      ? sorted.filter((member) => member.name.toLowerCase().includes(needle))
      : sorted;
  }, [members, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>Add a permit holder</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search names…"
          data-testid="add-permit-holder-search"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none focus:ring-1 focus:ring-scout-blue"
          aria-label="Search members"
        />
        <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-gray-100">
          {filtered.map((member) => {
            const alreadyOn = existingScoutids.includes(member.scoutid);
            return (
              <li key={member.scoutid}>
                <button
                  type="button"
                  disabled={alreadyOn}
                  onClick={() => onPick(member.scoutid)}
                  data-testid={`add-permit-holder-row-${member.scoutid}`}
                  className="w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <MemberAvatar
                    member={{ scoutid: member.scoutid, photo_guid: member.photo_guid, name: member.name }}
                    size="sm"
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800">{member.name}</span>
                  {alreadyOn && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      Already on
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-sm text-gray-500 text-center">
              No matching names.
            </li>
          )}
        </ul>
      </Modal.Body>
    </Modal>
  );
}

export default AddPermitHolderModal;
