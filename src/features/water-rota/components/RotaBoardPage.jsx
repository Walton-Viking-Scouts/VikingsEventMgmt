import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import SectionFilter from '../../../shared/components/ui/SectionFilter.jsx';
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
import { bucketSessionsByWeek, startOfIsoWeek } from '../utils/rotaDates.js';
import { useRotaPermissions } from '../hooks/useRotaPermissions.js';
import { useSectionYPCounts } from '../hooks/useSectionYPCounts.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { syncRotaWithProgramme } from '../services/rotaSetupService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { notifyError, notifyInfo, notifySuccess } from '../../../shared/utils/notifications.js';
import SessionCard from './SessionCard.jsx';
import TermOverviewStrip from './TermOverviewStrip.jsx';
import IdentityPickerModal from './IdentityPickerModal.jsx';
import SessionDetailModal from './SessionDetailModal.jsx';

const FILTERS_STORAGE_KEY = 'viking_water_rota_section_filters';

/**
 * Read persisted section filters, defaulting to everything visible.
 *
 * @returns {Object} Map of sectionId to boolean visibility
 */
function readStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * The rota board: term overview strip plus a week-bucketed session list
 * with one-tap signups and a session detail/edit modal. Auto-scrolls to
 * the current week on load. Renders empty/error/first-run states when
 * there is no rota for the year.
 *
 * @returns {JSX.Element} Board page
 */
function RotaBoardPage() {
  const navigate = useNavigate();
  const { loading, rota, error, refresh, year } = useWaterRota();
  const identityState = useRotaIdentity(rota);
  const { identity, needsPicker, choose } = identityState;
  const { setSignup, pendingFieldId } = useRotaSignup(rota, identity, refresh);
  const { canEdit } = useRotaPermissions(rota);

  const online = useOnlineStatus();
  const [sectionFilters, setSectionFilters] = useState(readStoredFilters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const weekRefs = useRef(new Map());
  const didAutoScroll = useRef(false);

  const sessions = useMemo(() => (rota ? resolveAllSessions(rota) : []), [rota]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.fieldId === selectedFieldId) ?? null,
    [sessions, selectedFieldId],
  );
  const { counts: ypCounts } = useSectionYPCounts(
    useMemo(() => (rota?.config?.cfg?.sections ?? []).map((entry) => entry.sid), [rota]),
  );

  const filterSections = useMemo(
    () =>
      (rota?.config?.cfg?.sections ?? []).map((entry) => ({
        sectionid: entry.sid,
        sectionname: entry.sname,
      })),
    [rota],
  );

  const visibleSessions = useMemo(
    () => sessions.filter((session) => sectionFilters[session.sectionId] !== false),
    [sessions, sectionFilters],
  );

  const allWeeks = useMemo(() => bucketSessionsByWeek(visibleSessions), [visibleSessions]);
  const currentWeekStart = startOfIsoWeek(format(new Date(), 'yyyy-MM-dd'));
  const [showPast, setShowPast] = useState(false);
  const pastWeekCount = useMemo(
    () => allWeeks.filter((week) => week.weekStart < currentWeekStart).length,
    [allWeeks, currentWeekStart],
  );
  const weeks = useMemo(
    () => (showPast ? allWeeks : allWeeks.filter((week) => week.weekStart >= currentWeekStart)),
    [allWeeks, showPast, currentWeekStart],
  );
  const pendingScrollWeek = useRef(null);

  useEffect(() => {
    if (pendingScrollWeek.current) {
      weekRefs.current.get(pendingScrollWeek.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      pendingScrollWeek.current = null;
    }
  }, [weeks]);

  useEffect(() => {
    if (didAutoScroll.current || weeks.length === 0) {
      return;
    }
    const target = weeks.find((week) => week.weekStart >= currentWeekStart) ?? weeks[weeks.length - 1];
    weekRefs.current.get(target.weekStart)?.scrollIntoView({ block: 'start' });
    didAutoScroll.current = true;
  }, [weeks, currentWeekStart]);

  const handleFiltersChange = (filters) => {
    setSectionFilters(filters);
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* non-fatal: filters just won't persist */
    }
  };

  const scrollToWeek = (weekStart) => {
    if (weekStart < currentWeekStart && !showPast) {
      pendingScrollWeek.current = weekStart;
      setShowPast(true);
      return;
    }
    weekRefs.current.get(weekStart)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSignupChange = (session, newStatus) => {
    if (!identity) {
      setPickerOpen(true);
      return;
    }
    const currentStatus = myStatusFor(session, identity.scoutid);
    if (withdrawalNeedsConfirm(session, currentStatus, newStatus)) {
      setConfirmChange({ session, newStatus });
      return;
    }
    setSignup(session.fieldId, newStatus);
  };

  const handleSyncProgramme = async () => {
    setSyncing(true);
    try {
      const { added, orphaned, errors } = await syncRotaWithProgramme({ rota, token: getToken() });
      if (errors.length > 0) {
        notifyError(`Sync finished with ${errors.length} error${errors.length === 1 ? '' : 's'} — try again to finish.`);
      } else if (added === 0 && orphaned.length === 0) {
        notifyInfo('Rota already matches the programmes.');
      } else {
        notifySuccess(`Added ${added} new session${added === 1 ? '' : 's'}.`);
      }
      if (orphaned.length > 0) {
        notifyInfo(
          `${orphaned.length} session${orphaned.length === 1 ? ' is' : 's are'} no longer on the programme — mark them not on water if needed.`,
        );
      }
      await refresh();
    } catch (error) {
      notifyError(`Programme sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading water rota..." />;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-gray-700 font-medium">Couldn&apos;t load the water rota</p>
        <p className="mt-1 text-sm text-gray-500">{error.message}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 px-4 py-2 rounded-md bg-scout-blue text-white text-sm font-medium hover:bg-scout-blue-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl" aria-hidden="true">🛶</div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          No water rota for {year} yet
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Set up this summer&apos;s on-water sessions from each section&apos;s programme, then
          permit holders can sign up to cover them.
        </p>
        <button
          type="button"
          onClick={() => navigate('/water-rota/setup')}
          className="mt-6 px-5 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark"
        >
          Set up the rota
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900">Water Rota {year}</h1>
        <div className="flex items-center gap-4">
          {canEdit && online && (
            <>
              <button
                type="button"
                onClick={() => navigate('/water-rota/setup')}
                className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium"
              >
                Edit plan
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={handleSyncProgramme}
                className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync programme'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {!online && (
        <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
          You&apos;re offline — showing the last loaded rota. Signups need a connection.
        </div>
      )}

      {needsPicker && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 w-full rounded-lg border border-scout-orange bg-scout-orange/10 px-4 py-2.5 text-left text-sm text-gray-800"
        >
          <span className="font-medium">Who are you?</span> Tap to pick your name so you
          can sign up to sessions.
        </button>
      )}

      {filterSections.length > 1 && (
        <div className="mt-3">
          <SectionFilter
            sections={filterSections}
            sectionFilters={sectionFilters}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      )}

      <div className="mt-3 sticky top-0 z-10 bg-white/95 backdrop-blur rounded-lg">
        <TermOverviewStrip
          weeks={allWeeks}
          currentWeekStart={currentWeekStart}
          onSelectWeek={scrollToWeek}
        />
      </div>

      {pastWeekCount > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((previous) => !previous)}
          className="mt-2 w-full py-1.5 text-xs font-medium text-gray-500 hover:text-scout-blue"
        >
          {showPast
            ? 'Hide earlier weeks'
            : `Show ${pastWeekCount} earlier week${pastWeekCount === 1 ? '' : 's'}`}
        </button>
      )}

      {allWeeks.length === 0 ? (
        <p className="mt-8 text-center text-sm text-gray-500">
          No sessions match the current filters.
        </p>
      ) : (
        <div className="mt-2 space-y-6 pb-12">
          {weeks.map(({ weekStart, sessions: weekSessions }) => (
            <section
              key={weekStart}
              ref={(node) => {
                if (node) {
                  weekRefs.current.set(weekStart, node);
                } else {
                  weekRefs.current.delete(weekStart);
                }
              }}
              aria-label={`Week of ${format(parseISO(weekStart), 'd MMMM yyyy')}`}
            >
              <h2 className={`text-sm font-semibold py-1.5 ${
                weekStart === currentWeekStart ? 'text-scout-blue' : 'text-gray-500'
              }`}>
                Week of {format(parseISO(weekStart), 'd MMMM')}
                {weekStart === currentWeekStart && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide">this week</span>
                )}
              </h2>
              <div className="space-y-2">
                {weekSessions.map((session) => (
                  <SessionCard
                    key={session.fieldId}
                    session={session}
                    onSelect={() => setSelectedFieldId(session.fieldId)}
                    myStatus={identity ? myStatusFor(session, identity.scoutid) : null}
                    onSignupChange={handleSignupChange}
                    signupDisabled={!online || (!identity && !needsPicker)}
                    signupPending={pendingFieldId === session.fieldId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          rota={rota}
          identity={identity}
          canEdit={canEdit}
          sectionYPCount={ypCounts[selectedSession.sectionId] ?? null}
          myStatus={identity ? myStatusFor(selectedSession, identity.scoutid) : null}
          signupPending={pendingFieldId === selectedSession.fieldId}
          onSignupChange={handleSignupChange}
          refresh={refresh}
          onClose={() => setSelectedFieldId(null)}
        />
      )}

      <IdentityPickerModal
        isOpen={pickerOpen}
        members={rota.members}
        onChoose={(scoutid) => {
          choose(scoutid);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

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
          setSignup(confirmChange.session.fieldId, confirmChange.newStatus);
          setConfirmChange(null);
        }}
        onCancel={() => setConfirmChange(null)}
      />
    </div>
  );
}

export default RotaBoardPage;
