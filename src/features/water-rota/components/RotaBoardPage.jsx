import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { copyToClipboard, shareOrigin } from '../../../shared/utils/clipboard.js';
import SessionMiniCard from './SessionMiniCard.jsx';
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
 * The rota board: season picker, term overview strip, and a week-bucketed
 * session list with one-tap signups and a session detail/edit modal.
 * Auto-scrolls to the current week on load. Renders empty/error/first-run
 * states when there is no rota for the season bucket.
 *
 * @returns {JSX.Element} Board page
 */
function RotaBoardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const seasonParam = searchParams.get('season');
  const { loading, rota, error, refresh, seasonBucket, buckets } = useWaterRota(seasonParam || undefined);
  const identityState = useRotaIdentity(rota);
  const { identity, needsPicker, choose, clear } = identityState;
  const { setSignup, pendingKey } = useRotaSignup(rota, identity, refresh);
  const { canEdit } = useRotaPermissions(rota);

  const online = useOnlineStatus();
  const [sectionFilters, setSectionFilters] = useState(readStoredFilters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const weekRefs = useRef(new Map());
  const didAutoScroll = useRef(false);
  const appliedUrlSection = useRef(false);
  const appliedUrlSeason = useRef(false);

  // The open session and the section filter are driven by the URL so the board
  // is deep-linkable and shareable: ?session=<key> opens that session's modal,
  // ?section=<id>[,<id>] narrows the board to those sections, ?season=<bucket>
  // pins the season. selectedKey is derived from the URL so the phone back
  // button closes the modal.
  const sectionParam = searchParams.get('section');
  const selectedKey = searchParams.get('session');

  // A season-less link pins the resolved default once discovery settles, so a
  // shared board link keeps showing the same season even after it stops being
  // the default.
  useEffect(() => {
    if (appliedUrlSeason.current || seasonParam || !seasonBucket) {
      return;
    }
    appliedUrlSeason.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('season', seasonBucket);
      return next;
    }, { replace: true });
  }, [seasonParam, seasonBucket, setSearchParams]);

  const handleSeasonChange = (event) => {
    const value = event.target.value;
    appliedUrlSeason.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('season', value);
      next.delete('session');
      return next;
    });
  };

  const openSession = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('session', key);
      return next;
    });
  };

  const closeSession = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('session');
        return next;
      },
      { replace: true },
    );
  };

  const sessions = useMemo(() => (rota ? resolveAllSessions(rota) : []), [rota]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.key === selectedKey) ?? null,
    [sessions, selectedKey],
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

  // filterSections only exists once the rota's config has loaded, and the
  // shared SectionFilter renders a pill as "off" unless its section id has
  // an explicit boolean — seed every current section to true (without
  // discarding a user's explicit false) once it's known.
  useEffect(() => {
    if (filterSections.length === 0) {
      return;
    }
    // A shared ?section= link narrows the board to those sections on first
    // load (without persisting — it shouldn't overwrite the recipient's own
    // saved filter). After that, normal seeding preserves their toggles.
    if (!appliedUrlSection.current && sectionParam) {
      appliedUrlSection.current = true;
      const wanted = new Set(sectionParam.split(',').map((id) => id.trim()));
      const matches = filterSections.some((section) => wanted.has(String(section.sectionid)));
      if (matches) {
        const only = {};
        for (const section of filterSections) {
          only[section.sectionid] = wanted.has(String(section.sectionid));
        }
        setSectionFilters(only);
        return;
      }
      // A shared link naming a section this user can't see must not strand them
      // on a blank board — fall through to normal all-sections seeding + explain.
      notifyInfo('That shared section isn\'t available to you — showing all sections.');
    }
    const allTrue = {};
    for (const section of filterSections) {
      allTrue[section.sectionid] = true;
    }
    const persisted = readStoredFilters();
    setSectionFilters((current) => ({ ...allTrue, ...persisted, ...current }));
  }, [filterSections, sectionParam]);

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

  const handleChangeIdentity = () => {
    clear();
    setPickerOpen(true);
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
    setSignup(session, newStatus);
  };

  const handleSyncProgramme = async () => {
    setSyncing(true);
    try {
      const token = getToken();
      let added = 0;
      let orphaned = 0;
      let titlesUpdated = 0;
      let titleWriteFailed = false;
      let titlesSkippedNoIdentity = false;
      const uncheckedSections = [];
      const failedSections = [];
      const sectionSyncErrors = [];

      // One record per planning section — sync each in turn so failures stay
      // scoped to that section instead of aborting the whole bucket.
      for (const record of rota.records ?? []) {
        const sectionLabel = record.config?.cfg?.sname ?? record.sectionNames?.[record.sectionId] ?? record.sectionId;
        try {
          const result = await syncRotaWithProgramme({ rota: record, token, scoutid: identity?.scoutid, by: identity?.name });
          added += result.added;
          orphaned += result.orphaned.length;
          titlesUpdated += result.titlesUpdated;
          titleWriteFailed = titleWriteFailed || result.titleWriteFailed;
          titlesSkippedNoIdentity = titlesSkippedNoIdentity || result.titlesSkippedNoIdentity;
          uncheckedSections.push(...result.uncheckedSections);
          failedSections.push(...result.failedSections);
          if (result.errors.length > 0) {
            sectionSyncErrors.push({ sectionLabel, errors: result.errors });
          }
        } catch (error) {
          sectionSyncErrors.push({ sectionLabel, errors: [{ error: error.message }] });
        }
      }

      if (sectionSyncErrors.length > 0) {
        const names = sectionSyncErrors.map((entry) => entry.sectionLabel).join(', ');
        notifyError(`Sync finished with errors for ${names} — try again to finish.`);
      } else if (
        added === 0 && orphaned === 0 && titlesUpdated === 0 &&
        !titleWriteFailed && !titlesSkippedNoIdentity &&
        uncheckedSections.length === 0 && failedSections.length === 0
      ) {
        notifyInfo('Rota already matches the programmes.');
      } else if (added > 0) {
        notifySuccess(`Added ${added} new session${added === 1 ? '' : 's'}.`);
      } else if (titlesUpdated > 0) {
        notifySuccess(`Updated ${titlesUpdated} session name${titlesUpdated === 1 ? '' : 's'} from the programme.`);
      }
      // A failed or un-attributable title write must never read as success.
      if (titleWriteFailed) {
        notifyError('Couldn’t save updated session names — try syncing again.');
      } else if (titlesSkippedNoIdentity) {
        notifyInfo('Session names weren’t updated — pick who you are on the rota first.');
      }
      if (orphaned > 0) {
        notifyInfo(
          `${orphaned} session${orphaned === 1 ? ' is' : 's are'} no longer on the programme — mark them not on water if needed.`,
        );
      }
      // A real fetch failure (e.g. an expired token) is an error, not the benign
      // "no active term" case — surface it so the leader knows nothing synced.
      if (failedSections.length > 0) {
        notifyError(
          `Couldn't reach OSM for ${failedSections.length} section${failedSections.length === 1 ? '' : 's'} — check you're still signed in and try again.`,
        );
      }
      if (uncheckedSections.length > 0) {
        notifyInfo(
          `${uncheckedSections.length} section${uncheckedSections.length === 1 ? ' has' : 's have'} no active term — their sessions were left unchanged.`,
        );
      }
      await refresh();
    } catch (error) {
      notifyError(`Programme sync failed: ${error.message}`, error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyBoardLink = async () => {
    const visible = filterSections
      .filter((section) => sectionFilters[section.sectionid] !== false)
      .map((section) => section.sectionid);
    const url = new URL('/water-rota', shareOrigin());
    // Only pin sections when the board is narrowed — an all-sections link is
    // just the plain board.
    const narrowed = visible.length > 0 && visible.length < filterSections.length;
    if (narrowed) {
      url.searchParams.set('section', visible.join(','));
    }
    const ok = await copyToClipboard(url.toString());
    if (ok) {
      notifySuccess(
        narrowed
          ? 'Link to these sections copied — paste it into WhatsApp.'
          : 'Board link copied — paste it into WhatsApp.',
      );
    } else {
      notifyError('Couldn\'t copy the link — copy it from the address bar.');
    }
  };

  // Only buckets with at least one record appear (PRD §3.4) — offered
  // whenever there's a real choice, in both the empty and loaded states, so a
  // season with no rota yet doesn't strand the user away from one that has.
  const seasonPicker = buckets.length > 1 && (
    <select
      value={seasonParam || seasonBucket || ''}
      onChange={handleSeasonChange}
      aria-label="Season"
      className="text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 bg-white"
    >
      {buckets.map((bucket) => (
        <option key={bucket} value={bucket}>{bucket}</option>
      ))}
    </select>
  );

  // Edit/setup links from the board only carry an unambiguous single-section
  // context — otherwise the wizard falls back to its own default.
  const soleSectionId = filterSections.length === 1 ? filterSections[0].sectionid : null;
  const setupPath = soleSectionId ? `/water-rota/setup?section=${soleSectionId}` : '/water-rota/setup';

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
        {seasonPicker && <div className="mb-4 flex justify-center">{seasonPicker}</div>}
        <div className="text-5xl" aria-hidden="true">🛶</div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          {seasonBucket ? `No water rota for ${seasonBucket} yet` : 'No water rota set up yet'}
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
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">Water Rota {rota.seasonBucket}</h1>
          {seasonPicker}
        </div>
        <div className="flex items-center gap-4">
          {canEdit && online && (
            <>
              <button
                type="button"
                onClick={() => navigate(setupPath)}
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
            onClick={handleCopyBoardLink}
            className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-scout-blue hover:text-scout-blue-dark font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {identity && (
        <div className="mt-1.5 text-xs text-gray-500">
          Signed in as <span className="font-medium text-gray-700">{identity.name}</span>
          {' · '}
          <button
            type="button"
            onClick={handleChangeIdentity}
            className="text-scout-blue hover:text-scout-blue-dark font-medium"
          >
            Change
          </button>
        </div>
      )}

      {!online && (
        <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
          You&apos;re offline — showing the last loaded rota. Signups need a connection.
        </div>
      )}

      {!rota.config && (
        <div className="mt-3 rounded-lg border border-scout-orange bg-scout-orange/10 px-4 py-3 text-sm text-gray-800">
          <p className="font-medium">Setup isn&apos;t finished.</p>
          <p className="mt-0.5 text-gray-600">
            The sessions exist but their activities, times and cover targets haven&apos;t been
            saved yet, so they show as &quot;needs setting up&quot;.
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => navigate(setupPath)}
              className="mt-2 px-4 py-1.5 rounded-md bg-scout-orange text-white text-sm font-semibold hover:opacity-90"
            >
              Finish setup
            </button>
          ) : (
            <p className="mt-1 text-gray-500">Ask a leader with edit access to finish it.</p>
          )}
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
              className={`rounded-xl border bg-white p-3 shadow-sm sm:p-4 ${
                weekStart === currentWeekStart ? 'border-scout-blue/40' : 'border-gray-200'
              }`}
            >
              <h2 className={`pb-2 text-sm font-semibold ${
                weekStart === currentWeekStart ? 'text-scout-blue' : 'text-gray-500'
              }`}>
                Week of {format(parseISO(weekStart), 'd MMMM')}
                {weekStart === currentWeekStart && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide">this week</span>
                )}
              </h2>
              {/* Every session that week tiles across the card — each section's
                  nights are separate tiles, filling the width instead of a
                  narrow per-day strip. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {weekSessions.map((session) => (
                  <SessionMiniCard
                    key={session.key}
                    session={session}
                    onSelect={() => openSession(session.key)}
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
          signupPending={Boolean(selectedSession.fieldId) && pendingKey === selectedSession.key}
          onSignupChange={handleSignupChange}
          refresh={refresh}
          onClose={closeSession}
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
          setSignup(confirmChange.session, confirmChange.newStatus);
          setConfirmChange(null);
        }}
        onCancel={() => setConfirmChange(null)}
      />
    </div>
  );
}

export default RotaBoardPage;
