import React, { useState } from 'react';
import Alert from '../../../shared/components/ui/Alert';
import useMissingFlexiRecords from '../hooks/useMissingFlexiRecords.js';
import CreateMissingFlexiModal from './CreateMissingFlexiModal';

/**
 * Determine whether the current session can perform OSM write operations.
 * Mirrors the offline-token gate enforced by tokenService.checkWritePermission.
 */
function canWrite() {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('token_expired') !== 'true';
}

/**
 * Banner that surfaces missing required FlexiRecords for the supplied sections
 * and lets the user fix them inline.
 *
 * Renders nothing when:
 *  - the session can't perform write operations (offline + expired token), or
 *  - every supplied section already has both required records.
 *
 * @param {Object} props
 * @param {Array<{ sectionid: string|number, sectionname?: string }>} props.sections
 */
export default function MissingFlexiRecordsBanner({ sections }) {
  const { loading, missing, refresh } = useMissingFlexiRecords(sections);
  const [modalOpen, setModalOpen] = useState(false);

  if (!canWrite()) return null;
  if (loading) return null;
  if (!missing || missing.length === 0) return null;

  const sectionsCount = missing.length;
  const recordsCount = missing.reduce((sum, gap) => sum + gap.missingRecords.length, 0);

  const summary = sectionsCount === 1
    ? `${sectionsCount} section is missing ${recordsCount} required FlexiRecord${recordsCount === 1 ? '' : 's'}.`
    : `${sectionsCount} sections are missing ${recordsCount} required FlexiRecord${recordsCount === 1 ? '' : 's'}.`;

  const handleClose = async () => {
    setModalOpen(false);
    await refresh();
  };

  return (
    <>
      <Alert variant="warning" className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-semibold">FlexiRecords need to be set up</div>
            <div className="text-sm">
              {summary} Sign-in, camp groups, and movements features depend on them.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="self-start sm:self-auto inline-flex items-center justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            Review and create
          </button>
        </div>
      </Alert>
      <CreateMissingFlexiModal
        isOpen={modalOpen}
        onClose={handleClose}
        missing={missing}
      />
    </>
  );
}
