import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import Modal from '../../../shared/components/ui/Modal.jsx';
import ConfirmModal from '../../../shared/components/ui/ConfirmModal.jsx';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { notifyError, notifySuccess } from '../../../shared/utils/notifications.js';
import { writeSessionMeta } from '../services/rotaService.js';
import { sectionChipClass } from '../utils/rotaDisplay.js';
import SignupList from './SignupList.jsx';
import SessionEditForm from './SessionEditForm.jsx';
import SignupButtons from './SignupButtons.jsx';

/**
 * Session detail: who's signed up, session notes, one-tap signup footer,
 * and — for plan editors — the edit form plus the "Not on water this week"
 * toggle.
 *
 * @param {Object} props
 * @param {import('../utils/rotaDisplay.js').SessionView|null} props.session - Session to show (null = closed)
 * @param {import('../services/rotaService.js').LoadedRota} props.rota - Loaded rota
 * @param {{scoutid: string, name: string}|null} props.identity - Resolved identity (required for edits/signups)
 * @param {boolean} props.canEdit - Offer plan-editing UI
 * @param {number|null} props.sectionYPCount - Section YP total for the kids default
 * @param {string|null} props.myStatus - Current user's signup status
 * @param {boolean} props.signupPending - Signup write in flight for this session
 * @param {Function} props.onSignupChange - Called with (session, newStatus)
 * @param {Function} props.refresh - Re-load the rota after an edit
 * @param {Function} props.onClose - Close the modal
 * @returns {JSX.Element|null} Detail modal
 */
function SessionDetailModal({
  session,
  rota,
  identity,
  canEdit,
  sectionYPCount,
  myStatus,
  signupPending,
  onSignupChange,
  refresh,
  onClose,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOffWater, setConfirmOffWater] = useState(false);

  if (!session) {
    return null;
  }

  const saveMeta = async (fields, { successText } = {}) => {
    if (!identity) {
      notifyError('Pick your name first so edits can be attributed to you.');
      return;
    }
    setSaving(true);
    try {
      await writeSessionMeta({
        rota,
        fieldId: session.fieldId,
        scoutid: identity.scoutid,
        by: identity.name,
        fields,
        token: getToken(),
      });
      notifySuccess(successText ?? 'Session updated');
      setEditing(false);
      await refresh();
      onClose();
    } catch (error) {
      notifyError(`Couldn't save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const currentFields = {
    act: session.activity || 'On the water',
    st: session.startTime || '18:30',
    en: session.endTime || '20:00',
    k: session.kids ?? sectionYPCount ?? 0,
    p: session.needed ?? 0,
    n: session.notes,
  };

  const handleSave = (fields) => saveMeta({ ...fields, c: session.cancelled ? 1 : 0 });
  const setOnWater = (onWater) =>
    saveMeta(
      { ...currentFields, c: onWater ? 0 : 1 },
      { successText: onWater ? 'Session restored' : 'Marked not on water' },
    );

  return (
    <Modal isOpen onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>
          <span className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sectionChipClass(session.sectionName)}`}>
              {session.sectionName}
            </span>
            <span>{format(parseISO(session.date), 'EEEE d MMMM')}</span>
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {session.cancelled ? (
          <p className="text-sm font-medium text-gray-500">
            Not on water this week.
          </p>
        ) : editing ? (
          <SessionEditForm
            session={session}
            sectionYPCount={sectionYPCount}
            saving={saving}
            onSave={handleSave}
          />
        ) : (
          <>
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                {session.activity || 'Activity not set'}
                {session.startTime && (
                  <span className="ml-2 font-normal text-gray-500">
                    {session.startTime}–{session.endTime}
                  </span>
                )}
              </p>
              {session.kids !== null && (
                <p className="mt-0.5 text-gray-500">Expecting ~{session.kids} young people</p>
              )}
              {session.notes && (
                <p className="mt-2 whitespace-pre-line text-gray-600">{session.notes}</p>
              )}
            </div>
            <div className="mt-4">
              <SignupList session={session} />
            </div>
          </>
        )}

        {canEdit && !editing && !session.fieldId && (
          <p className="mt-5 text-xs text-gray-500">
            This programme week isn&apos;t set up as a water session. Add it from the
            board&apos;s &quot;Edit plan&quot; or &quot;Sync programme&quot;.
          </p>
        )}

        {canEdit && !editing && session.fieldId && (
          <div className="mt-5 flex gap-2">
            {!session.cancelled && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-1 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:border-scout-blue hover:text-scout-blue"
              >
                Edit session
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => (session.cancelled ? setOnWater(true) : setConfirmOffWater(true))}
              className="flex-1 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:border-scout-orange hover:text-scout-orange disabled:opacity-50"
            >
              {session.cancelled ? 'Back on the water' : 'Not on water this week'}
            </button>
          </div>
        )}
      </Modal.Body>

      {!session.cancelled && !editing && session.fieldId && (
        <Modal.Footer>
          <div className="w-full">
            <SignupButtons
              myStatus={myStatus}
              disabled={!identity || signupPending}
              pending={signupPending}
              onChange={(newStatus) => onSignupChange(session, newStatus)}
            />
          </div>
        </Modal.Footer>
      )}

      <ConfirmModal
        isOpen={confirmOffWater}
        title="Not on water this week?"
        message={`${format(parseISO(session.date), 'EEEE d MMMM')} will be greyed out on the board and removed from cover warnings. Signups are kept and it can be restored.`}
        confirmText="Not on water"
        cancelText="Keep it"
        confirmVariant="warning"
        onConfirm={() => {
          setConfirmOffWater(false);
          setOnWater(false);
        }}
        onCancel={() => setConfirmOffWater(false)}
      />
    </Modal>
  );
}

export default SessionDetailModal;
