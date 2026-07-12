import React, { useMemo, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal.jsx';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';

/**
 * Asks the user which host-section member row is theirs when the automatic
 * full-name match fails or is ambiguous. Searchable; choice persists per
 * rota record via useRotaIdentity.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is shown
 * @param {Array<{scoutid: string, name: string}>} props.members - Host-section member rows
 * @param {Function} props.onChoose - Called with the chosen scoutid
 * @param {Function} props.onClose - Dismiss without choosing
 * @returns {JSX.Element} Identity picker modal
 */
function IdentityPickerModal({ isOpen, members, onChoose, onClose }) {
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
        <Modal.Title>Who are you?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-gray-600">
          Pick your name so signups go against the right person. You&apos;ll only
          need to do this once.
        </p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search names…"
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none focus:ring-1 focus:ring-scout-blue"
          aria-label="Search members"
        />
        <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-gray-100">
          {filtered.map((member) => (
            <li key={member.scoutid}>
              <button
                type="button"
                onClick={() => onChoose(member.scoutid)}
                className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-50 rounded-md"
              >
                <MemberAvatar
                  member={{ scoutid: member.scoutid, photo_guid: member.photo_guid, name: member.name }}
                  size="md"
                />
                <span className="text-sm font-medium text-gray-800">{member.name}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-sm text-gray-500 text-center">
              No matching names. If you&apos;re not listed, ask your admin to add you
              to the rota&apos;s host section in OSM.
            </li>
          )}
        </ul>
      </Modal.Body>
    </Modal>
  );
}

export default IdentityPickerModal;
