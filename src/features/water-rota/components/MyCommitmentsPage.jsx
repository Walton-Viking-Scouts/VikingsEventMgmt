import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ConfirmModal from '../../../shared/components/ui/ConfirmModal.jsx';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { useWaterRota } from '../hooks/useWaterRota.js';
import { useRotaIdentity } from '../hooks/useRotaIdentity.js';
import { useRotaSignup } from '../hooks/useRotaSignup.js';
import {
  myStatusFor,
  resolveAllSessions,
  withdrawalNeedsConfirm,
} from '../utils/rotaDisplay.js';
import { groupByHorizon } from '../utils/rotaDates.js';
import SessionCard from './SessionCard.jsx';
import IdentityPickerModal from './IdentityPickerModal.jsx';

const BUCKET_LABELS = [
  ['thisWeek', 'This week'],
  ['nextWeek', 'Next week'],
  ['later', 'Later'],
];

/**
 * A permit holder's week: every upcoming session they are confirmed or
 * backup for, bucketed into this week / next week / later, with inline
 * withdraw.
 *
 * @returns {JSX.Element} My commitments page
 */
function MyCommitmentsPage() {
  const { loading, rota, error, refresh } = useWaterRota();
  // useRotaIdentity resolves once per host section (WP5 will formalize this);
  // the group has no top-level recordId, so shim one from the shared host
  // section id — the same value WP5's per-host-section storage key will use.
  const identityState = useRotaIdentity(
    rota ? { recordId: rota.hostSection?.sectionid ?? null, members: rota.members } : null,
  );
  const { identity, needsPicker, choose } = identityState;
  const { setSignup, pendingKey } = useRotaSignup(rota, identity, refresh);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);

  const mySessions = useMemo(() => {
    if (!rota || !identity) {
      return [];
    }
    return resolveAllSessions(rota).filter(
      (session) => !session.cancelled && myStatusFor(session, identity.scoutid) !== null,
    );
  }, [rota, identity]);

  const buckets = useMemo(
    () => groupByHorizon(mySessions, format(new Date(), 'yyyy-MM-dd')),
    [mySessions],
  );

  const upcomingSoon = buckets.thisWeek.length + buckets.nextWeek.length;

  const handleSignupChange = (session, newStatus) => {
    const currentStatus = myStatusFor(session, identity.scoutid);
    if (withdrawalNeedsConfirm(session, currentStatus, newStatus)) {
      setConfirmChange({ session, newStatus });
      return;
    }
    setSignup(session, newStatus);
  };

  if (loading) {
    return <LoadingScreen message="Loading your sessions..." />;
  }

  if (error || !rota) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-sm text-gray-500">
        {error ? `Couldn't load the rota: ${error.message}` : 'No water rota set up yet.'}
        <div className="mt-3">
          <Link to="/water-rota" className="text-scout-blue font-medium">
            Go to the board
          </Link>
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Who are you?</h2>
        <p className="mt-2 text-sm text-gray-500">
          Pick your name to see your sessions and sign up.
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-5 px-5 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark"
        >
          Pick my name
        </button>
        <IdentityPickerModal
          isOpen={pickerOpen}
          members={rota.members}
          onChoose={(scoutid) => {
            choose(scoutid);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
        {!needsPicker && (
          <p className="mt-4 text-xs text-gray-400">
            Your name couldn&apos;t be matched automatically.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <h1 className="text-lg font-semibold text-gray-900">My sessions</h1>
      <p className="mt-1 text-sm text-gray-600">
        {upcomingSoon === 0
          ? 'Nothing in the next two weeks.'
          : `You're covering ${upcomingSoon} session${upcomingSoon === 1 ? '' : 's'} in the next two weeks.`}
      </p>

      {mySessions.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            You haven&apos;t signed up to any sessions yet.
          </p>
          <Link
            to="/water-rota"
            className="mt-3 inline-block px-5 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark"
          >
            See who needs cover
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-6 pb-12">
          {BUCKET_LABELS.map(([key, label]) =>
            buckets[key].length === 0 ? null : (
              <section key={key} aria-label={label}>
                <h2 className="text-sm font-semibold text-gray-500 py-1.5">{label}</h2>
                <div className="space-y-2">
                  {buckets[key].map((session) => (
                    <SessionCard
                      key={session.key}
                      session={session}
                      myStatus={myStatusFor(session, identity.scoutid)}
                      onSignupChange={handleSignupChange}
                      signupPending={Boolean(session.fieldId) && pendingKey === session.key}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmChange)}
        title="Leave this session short?"
        message={
          confirmChange
            ? `This session needs ${confirmChange.session.needed} permit holder${confirmChange.session.needed === 1 ? '' : 's'} and losing you leaves ${confirmChange.session.confirmed.length - 1} confirmed. Withdraw anyway?`
            : ''
        }
        confirmText="Withdraw"
        cancelText="Stay signed up"
        confirmVariant="warning"
        onConfirm={() => {
          setSignup(confirmChange.session, confirmChange.newStatus);
          setConfirmChange(null);
        }}
        onCancel={() => setConfirmChange(null)}
      />
    </div>
  );
}

export default MyCommitmentsPage;
