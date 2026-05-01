import React, { useEffect, useId, useMemo, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import { notifySuccess, notifyError } from '../../../shared/utils/notifications.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { createOrCompleteFlexiRecord } from '../services/flexiRecordCreationService.js';

const BUTTON_BASE = 'inline-flex items-center justify-center rounded-md font-medium px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-scout-blue text-white hover:bg-scout-blue-dark focus:ring-scout-blue-light`;
const BUTTON_SECONDARY = `${BUTTON_BASE} bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300`;

const STATUS_ICON = {
  pending: <span className="inline-block w-3 h-3 rounded-full bg-gray-300" aria-label="pending" />,
  inProgress: <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse" aria-label="in progress" />,
  success: <span className="inline-block w-3 h-3 rounded-full bg-green-500" aria-label="success" />,
  failed: <span className="inline-block w-3 h-3 rounded-full bg-red-500" aria-label="failed" />,
  skipped: <span className="inline-block w-3 h-3 rounded-full bg-gray-200 border border-gray-300" aria-label="skipped" />,
};

/**
 * Build the initial table model from the missing-records gap list.
 * Each cell key is `${sectionid}::${templateName}` for stable React keys.
 */
function buildInitialCells(missing) {
  const cells = {};
  for (const gap of missing) {
    for (const record of gap.missingRecords) {
      const key = `${gap.section.sectionid}::${record.template.name}`;
      cells[key] = {
        sectionid: gap.section.sectionid,
        sectionname: gap.section.sectionname,
        termId: gap.termId,
        template: record.template,
        reason: record.reason,
        missingFields: record.missingFields,
        selected: true,
        status: 'pending',
        error: null,
        addedFields: [],
      };
    }
  }
  return cells;
}

/**
 * Modal that lets the user create / complete missing FlexiRecords for sections.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose - Called when the user closes the modal (after creation completes)
 * @param {Array<import('../hooks/useMissingFlexiRecords.js').SectionGap>} props.missing
 */
export default function CreateMissingFlexiModal({ isOpen, onClose, missing }) {
  const titleId = useId();
  const [showFields, setShowFields] = useState(false);
  const [cells, setCells] = useState(() => buildInitialCells(missing || []));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCells(buildInitialCells(missing || []));
      setShowFields(false);
    }
  }, [isOpen, missing]);

  const sections = useMemo(() => {
    const seen = new Map();
    Object.values(cells).forEach(c => {
      if (!seen.has(c.sectionid)) {
        seen.set(c.sectionid, { sectionid: c.sectionid, sectionname: c.sectionname });
      }
    });
    return Array.from(seen.values());
  }, [cells]);

  const templates = useMemo(() => {
    const seen = new Map();
    Object.values(cells).forEach(c => {
      if (!seen.has(c.template.name)) seen.set(c.template.name, c.template);
    });
    return Array.from(seen.values());
  }, [cells]);

  const cellKey = (sectionid, templateName) => `${sectionid}::${templateName}`;
  const cellFor = (sectionid, templateName) => cells[cellKey(sectionid, templateName)];

  const selectedCount = Object.values(cells).filter(c => c.selected && c.status === 'pending').length;
  const failedCount = Object.values(cells).filter(c => c.status === 'failed').length;
  const successCount = Object.values(cells).filter(c => c.status === 'success').length;
  const allDone = !running && Object.values(cells).every(c => c.status !== 'pending' || !c.selected);

  const toggleCell = (key) => {
    if (running) return;
    setCells(prev => {
      const cell = prev[key];
      if (!cell || cell.status !== 'pending') return prev;
      return { ...prev, [key]: { ...cell, selected: !cell.selected } };
    });
  };

  /**
   * Iterate over selected cells and call createOrCompleteFlexiRecord for each.
   *
   * The snapshot is captured at call-time by the caller (handleSubmit /
   * handleRetryFailed) — passing it explicitly avoids the stale-closure
   * problem that would otherwise read pre-update values during the loop.
   *
   * @param {string[]} keysToRun - Cell keys to process this run
   * @param {Object<string, Object>} snapshot - Frozen view of `cells` for this run
   */
  const runCreation = async (keysToRun, snapshot) => {
    const token = getToken();
    if (!token) {
      notifyError('Cannot create FlexiRecords without a valid OSM session.');
      return;
    }

    setRunning(true);
    let okCount = 0;
    let failCount = 0;

    for (const key of keysToRun) {
      const cell = snapshot[key];
      if (!cell) {
        logger.warn('runCreation: missing cell in snapshot — skipping', { key }, LOG_CATEGORIES.COMPONENT);
        continue;
      }

      setCells(prev => ({
        ...prev,
        [key]: { ...prev[key], status: 'inProgress', error: null },
      }));

      const result = await createOrCompleteFlexiRecord({
        section: { sectionid: cell.sectionid, sectionname: cell.sectionname },
        template: cell.template,
        termId: cell.termId,
        token,
      });

      if (result.success) {
        okCount += 1;
        setCells(prev => {
          const previousAdded = prev[key]?.addedFields || [];
          const merged = Array.from(new Set([...previousAdded, ...result.addedFields]));
          return {
            ...prev,
            [key]: { ...prev[key], status: 'success', addedFields: merged, error: null },
          };
        });
      } else {
        failCount += 1;
        const detail = result.errors.map(e => `${e.field}: ${e.error}`).join('; ') || 'Unknown error';
        setCells(prev => {
          const previousAdded = prev[key]?.addedFields || [];
          const merged = Array.from(new Set([...previousAdded, ...result.addedFields]));
          return {
            ...prev,
            [key]: { ...prev[key], status: 'failed', error: detail, addedFields: merged },
          };
        });
      }
    }

    setRunning(false);

    if (okCount && !failCount) {
      notifySuccess(`Created ${okCount} FlexiRecord${okCount === 1 ? '' : 's'} successfully.`);
    } else if (okCount && failCount) {
      notifyError(`Created ${okCount}, failed ${failCount}. Review the table for details.`);
    } else if (failCount && !okCount) {
      notifyError(`All ${failCount} create operations failed. Review the table for details.`);
    }
  };

  const handleSubmit = () => {
    const keys = Object.entries(cells)
      .filter(([, c]) => c.selected && c.status === 'pending')
      .map(([k]) => k);
    if (keys.length === 0) return;
    runCreation(keys, { ...cells });
  };

  const handleRetryFailed = () => {
    const failedKeys = Object.entries(cells)
      .filter(([, c]) => c.status === 'failed')
      .map(([k]) => k);
    if (failedKeys.length === 0) return;

    const retrySnapshot = {};
    setCells(prev => {
      const next = { ...prev };
      for (const k of failedKeys) {
        next[k] = { ...next[k], status: 'pending', error: null };
        retrySnapshot[k] = next[k];
      }
      return next;
    });
    runCreation(failedKeys, retrySnapshot);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={running ? undefined : onClose}
      size="3xl"
      closeOnOverlayClick={false}
      closeOnEscape={!running}
      ariaLabelledBy={titleId}
    >
      <Modal.Header>
        <Modal.Title id={titleId}>Create missing FlexiRecords</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-700 mb-4">
          The following sections are missing FlexiRecords required by sign-in, camp groups, or movements features.
          Untick anything you don&apos;t want to create.
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="text-left px-3 py-2 font-semibold text-gray-700">Section</th>
                {templates.map(t => (
                  <th key={t.name} scope="col" className="text-left px-3 py-2 font-semibold text-gray-700">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sections.map(section => (
                <tr key={section.sectionid}>
                  <td className="px-3 py-2 text-gray-900">{section.sectionname}</td>
                  {templates.map(t => {
                    const cell = cellFor(section.sectionid, t.name);
                    if (!cell) {
                      return (
                        <td key={t.name} className="px-3 py-2 text-gray-400">
                          <span aria-label="already present">—</span>
                        </td>
                      );
                    }
                    const label = cell.reason === 'absent'
                      ? 'Create record'
                      : `Add ${cell.missingFields.length} field${cell.missingFields.length === 1 ? '' : 's'}`;
                    return (
                      <td key={t.name} className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          {cell.status === 'pending' ? (
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-scout-blue focus:ring-scout-blue"
                              checked={cell.selected}
                              onChange={() => toggleCell(cellKey(section.sectionid, t.name))}
                              disabled={running}
                            />
                          ) : (
                            STATUS_ICON[cell.status] || STATUS_ICON.pending
                          )}
                          <span className={cell.status === 'failed' ? 'text-red-700' : 'text-gray-700'}>
                            {label}
                          </span>
                        </label>
                        {cell.status === 'failed' && cell.error && (
                          <div className="mt-1 text-xs text-red-700 break-words">{cell.error}</div>
                        )}
                        {cell.status === 'success' && cell.addedFields.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Added: {cell.addedFields.join(', ')}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="mt-4 text-sm text-scout-blue hover:underline"
          onClick={() => setShowFields(s => !s)}
        >
          {showFields ? 'Hide' : 'Show'} fields that will be created
        </button>

        {showFields && (
          <dl className="mt-2 text-sm text-gray-700 space-y-2">
            {templates.map(t => (
              <div key={t.name}>
                <dt className="font-semibold">{t.name}</dt>
                <dd className="ml-4 text-gray-600">
                  Fields: {t.fields.join(', ')}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal.Body>
      <Modal.Footer align="between">
        <div className="text-sm text-gray-600 self-center">
          {running && 'Working…'}
          {!running && allDone && (
            <span>
              {successCount} succeeded{failedCount > 0 ? `, ${failedCount} failed` : ''}
            </span>
          )}
          {!running && !allDone && selectedCount > 0 && (
            <span>{selectedCount} selected</span>
          )}
        </div>
        <div className="flex gap-2">
          {failedCount > 0 && !running && (
            <button type="button" className={BUTTON_SECONDARY} onClick={handleRetryFailed}>
              Retry failed
            </button>
          )}
          <button
            type="button"
            className={BUTTON_SECONDARY}
            onClick={onClose}
            disabled={running}
          >
            {allDone ? 'Close' : 'Cancel'}
          </button>
          {!allDone && (
            <button
              type="button"
              className={BUTTON_PRIMARY}
              onClick={handleSubmit}
              disabled={running || selectedCount === 0}
            >
              {running ? 'Creating…' : `Create ${selectedCount} FlexiRecord${selectedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}
