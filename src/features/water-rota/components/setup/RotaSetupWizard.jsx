import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import { getToken } from '../../../../shared/services/auth/tokenService.js';
import { notifyError, notifySuccess } from '../../../../shared/utils/notifications.js';
import LoadingScreen from '../../../../shared/components/LoadingScreen.jsx';
import logger, { LOG_CATEGORIES } from '../../../../shared/services/utils/logger.js';
import { fetchProgrammeMeetings } from '../../services/programmeService.js';
import { createOrCompleteRota, writeRotaConfig } from '../../services/rotaSetupService.js';
import { loadRota } from '../../services/rotaService.js';
import { ACTIVITY_PRESETS, DEFAULT_PERMIT_HOLDERS, DEFAULT_SESSION_TIMES } from '../../services/rotaTemplates.js';
import { expandWeeklySlot, generateSessionsFromProgramme, bucketSessionsByWeek } from '../../utils/rotaDates.js';
import { getCurrentUserName } from '../../hooks/useRotaIdentity.js';
import { useSectionYPCounts } from '../../hooks/useSectionYPCounts.js';
import { sectionChipClass } from '../../utils/rotaDisplay.js';

const WEEKDAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun'],
];

/**
 * Default per-section plan used until the leader adjusts it.
 *
 * @returns {Object} Plan defaults
 */
function defaultPlan() {
  return {
    act: ACTIVITY_PRESETS[0],
    st: DEFAULT_SESSION_TIMES.start,
    en: DEFAULT_SESSION_TIMES.end,
    k: null,
    p: DEFAULT_PERMIT_HOLDERS,
    meetings: null,
    excluded: {},
    slotWeekday: 2,
  };
}

/**
 * Build session descriptors for one section from its plan: programme
 * meetings (minus unticked ones) when the programme has any, otherwise the
 * weekly slot fallback.
 *
 * @param {Object} section - {sid, sname}
 * @param {Object} plan - Per-section plan state
 * @param {{start: string, end: string}} range - Rota date range
 * @returns {Array} Session descriptors
 */
function sessionsForSection(section, plan, range) {
  const sectionCfg = { sid: section.sid, sname: section.sname, act: plan.act, st: plan.st, en: plan.en };
  if (plan.meetings && plan.meetings.length > 0) {
    const included = plan.meetings.filter((meeting) => !plan.excluded[meeting.date]);
    return generateSessionsFromProgramme(included, sectionCfg, range);
  }
  return expandWeeklySlot({ weekday: plan.slotWeekday, ...sectionCfg }, range);
}

/**
 * Three-step wizard creating the yearly rota record: (1) host section,
 * participating sections, and date range; (2) programme review with
 * on-water checkboxes per meeting (weekly-slot fallback for sections with
 * an empty programme); (3) preview and resumable creation, followed by the
 * initial plan-config write attributed to the resolved identity.
 *
 * @returns {JSX.Element} Setup wizard page
 */
function RotaSetupWizard() {
  const navigate = useNavigate();
  const token = getToken();

  const [step, setStep] = useState(1);
  const [sections, setSections] = useState(null);
  const [hostSectionId, setHostSectionId] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});
  const [range, setRange] = useState({ start: '', end: '' });
  const [plans, setPlans] = useState({});
  const [loadingProgramme, setLoadingProgramme] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationErrors, setCreationErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const cached = (await databaseService.getSections()) || [];
      if (cancelled) {
        return;
      }
      setSections(cached);
      const adults = cached.find((section) =>
        `${section.section ?? ''} ${section.sectionname ?? ''}`.toLowerCase().includes('adult'),
      );
      if (adults) {
        setHostSectionId(String(adults.sectionid));
      }
      const nonAdults = cached.filter((section) => section !== adults);
      setSelectedIds(Object.fromEntries(nonAdults.map((section) => [String(section.sectionid), true])));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function defaultRange() {
      if (!hostSectionId || range.start) {
        return;
      }
      try {
        const term = await CurrentActiveTermsService.getCurrentActiveTerm(hostSectionId);
        if (!cancelled && term?.startDate && term?.endDate) {
          setRange({
            start: term.startDate.slice(0, 10),
            end: term.endDate.slice(0, 10),
          });
        }
      } catch {
        /* leave range for the leader to type */
      }
    }
    defaultRange();
    return () => {
      cancelled = true;
    };
  }, [hostSectionId, range.start]);

  const hostSection = useMemo(
    () => (sections ?? []).find((section) => String(section.sectionid) === hostSectionId) ?? null,
    [sections, hostSectionId],
  );

  const participating = useMemo(
    () =>
      (sections ?? [])
        .filter((section) => selectedIds[String(section.sectionid)])
        .map((section) => ({ sid: String(section.sectionid), sname: section.sectionname })),
    [sections, selectedIds],
  );

  const { counts: ypCounts } = useSectionYPCounts(
    useMemo(() => participating.map((section) => section.sid), [participating]),
  );

  const allSessions = useMemo(
    () =>
      participating.flatMap((section) =>
        plans[section.sid] ? sessionsForSection(section, plans[section.sid], range) : [],
      ),
    [participating, plans, range],
  );

  const year = range.start ? Number(range.start.slice(0, 4)) : new Date().getFullYear();

  const startProgrammeReview = async () => {
    setLoadingProgramme(true);
    const nextPlans = {};
    for (const section of participating) {
      const plan = plans[section.sid] ?? defaultPlan();
      const withKids = { ...plan, k: plan.k ?? ypCounts[section.sid] ?? null };
      try {
        const term = await CurrentActiveTermsService.getCurrentActiveTerm(section.sid);
        const meetings = term?.currentTermId
          ? await fetchProgrammeMeetings(section.sid, term.currentTermId, token)
          : [];
        nextPlans[section.sid] = { ...withKids, meetings };
      } catch (error) {
        logger.warn('Programme fetch failed during setup', {
          sectionId: section.sid,
          error: error.message,
        }, LOG_CATEGORIES.API);
        nextPlans[section.sid] = { ...withKids, meetings: [] };
      }
    }
    setPlans(nextPlans);
    setLoadingProgramme(false);
    setStep(2);
  };

  const updatePlan = (sid, patch) => {
    setPlans((previous) => ({ ...previous, [sid]: { ...previous[sid], ...patch } }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreationErrors([]);
    try {
      const result = await createOrCompleteRota({
        hostSection,
        year,
        termId: (await CurrentActiveTermsService.getCurrentActiveTerm(hostSectionId))?.currentTermId,
        sessions: allSessions,
        token,
      });

      if (!result.success) {
        setCreationErrors(result.errors ?? [{ field: '_meta', error: 'Unknown creation failure' }]);
        return;
      }

      const rota = await loadRota(year, token);
      if (!rota) {
        setCreationErrors([{ field: '_meta', error: 'Record created but could not be re-loaded' }]);
        return;
      }

      // The plan config is section-level data (not per-member), so it is
      // written to a deterministic member row rather than the operator's own
      // row. This decouples "did setup finish" from identity resolution — an
      // unmatched name can no longer leave a rota with columns but no config.
      const configRow = [...rota.members].sort((a, b) => a.scoutid.localeCompare(b.scoutid))[0];
      if (!configRow) {
        setCreationErrors([{ field: 'RotaConfig', error: 'Host section has no members to store the plan against' }]);
        return;
      }

      const by = (await getCurrentUserName()) ?? 'Setup';
      await writeRotaConfig({
        hostSection,
        recordId: result.flexirecordid,
        termId: rota.termId,
        scoutid: configRow.scoutid,
        by,
        cfg: {
          start: range.start,
          end: range.end,
          sections: participating.map((section) => {
            const plan = plans[section.sid];
            return {
              sid: section.sid,
              sname: section.sname,
              act: plan.act,
              st: plan.st,
              en: plan.en,
              k: plan.k ?? ypCounts[section.sid] ?? 0,
              p: plan.p ?? DEFAULT_PERMIT_HOLDERS,
            };
          }),
        },
        token,
      });

      notifySuccess('Water rota saved');
      navigate('/water-rota');
    } catch (error) {
      notifyError(`Setup failed: ${error.message}`);
      setCreationErrors([{ field: '_meta', error: error.message }]);
    } finally {
      setCreating(false);
    }
  };

  if (!sections) {
    return <LoadingScreen message="Loading sections..." />;
  }

  const stepBadge = (n, label) => (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${step === n ? 'text-scout-blue' : 'text-gray-400'}`}>
      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] ${
        step === n ? 'bg-scout-blue text-white' : 'bg-gray-200 text-gray-500'
      }`}>{n}</span>
      {label}
    </span>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-16">
      <h1 className="text-lg font-semibold text-gray-900">Set up the water rota</h1>
      <div className="mt-2 flex gap-4">
        {stepBadge(1, 'Basics')}
        {stepBadge(2, 'Programme')}
        {stepBadge(3, 'Create')}
      </div>

      {step === 1 && (
        <div className="mt-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Host section</label>
            <p className="text-xs text-gray-500">
              The rota lives in this section — pick one all your permit holders belong to
              (usually Adults).
            </p>
            <select
              value={hostSectionId ?? ''}
              onChange={(event) => setHostSectionId(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
              aria-label="Host section"
            >
              <option value="" disabled>Choose a section…</option>
              {sections.map((section) => (
                <option key={section.sectionid} value={String(section.sectionid)}>
                  {section.sectionname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Sections going on the water</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sections.map((section) => {
                const sid = String(section.sectionid);
                const active = Boolean(selectedIds[sid]);
                return (
                  <button
                    key={sid}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedIds((previous) => ({ ...previous, [sid]: !previous[sid] }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      active
                        ? sectionChipClass(section.sectionname) + ' border-transparent'
                        : 'bg-white border-gray-300 text-gray-500'
                    }`}
                  >
                    {section.sectionname}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="rota-range-start">First week</label>
              <input
                id="rota-range-start"
                type="date"
                value={range.start}
                onChange={(event) => setRange((previous) => ({ ...previous, start: event.target.value }))}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="rota-range-end">Last week</label>
              <input
                id="rota-range-end"
                type="date"
                value={range.end}
                onChange={(event) => setRange((previous) => ({ ...previous, end: event.target.value }))}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!hostSection || participating.length === 0 || !range.start || !range.end || range.end < range.start || loadingProgramme}
            onClick={startProgrammeReview}
            className="w-full py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark disabled:opacity-50"
          >
            {loadingProgramme ? 'Reading programmes…' : 'Next: review programmes'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 space-y-6">
          {participating.map((section) => {
            const plan = plans[section.sid];
            if (!plan) {
              return null;
            }
            const hasProgramme = plan.meetings && plan.meetings.length > 0;
            const visibleMeetings = (plan.meetings ?? []).filter(
              (meeting) => meeting.date >= range.start && meeting.date <= range.end,
            );
            return (
              <section key={section.sid} className="rounded-lg border border-gray-200 p-4">
                <h2 className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sectionChipClass(section.sname)}`}>
                    {section.sname}
                  </span>
                  <span className="text-xs text-gray-500">
                    {hasProgramme
                      ? `${visibleMeetings.length} programme meeting${visibleMeetings.length === 1 ? '' : 's'} in range`
                      : 'No programme found — using a weekly slot'}
                  </span>
                </h2>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Default activity</label>
                    <select
                      value={plan.act}
                      onChange={(event) => updatePlan(section.sid, { act: event.target.value })}
                      className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                    >
                      {ACTIVITY_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>{preset}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Start</label>
                    <input
                      type="time"
                      value={plan.st}
                      onChange={(event) => updatePlan(section.sid, { st: event.target.value })}
                      className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">End</label>
                    <input
                      type="time"
                      value={plan.en}
                      onChange={(event) => updatePlan(section.sid, { en: event.target.value })}
                      className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                    />
                  </div>
                  {!hasProgramme && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Evening</label>
                      <select
                        value={plan.slotWeekday}
                        onChange={(event) => updatePlan(section.sid, { slotWeekday: Number(event.target.value) })}
                        className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                      >
                        {WEEKDAYS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Expected YP</label>
                    <input
                      type="number"
                      min="0"
                      value={plan.k ?? ypCounts[section.sid] ?? 0}
                      onChange={(event) => updatePlan(section.sid, { k: Math.max(0, Number(event.target.value) || 0) })}
                      className="mt-1 w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                      aria-label={`Expected young people for ${section.sname}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Permit holders</label>
                    <input
                      type="number"
                      min="0"
                      value={plan.p}
                      onChange={(event) => updatePlan(section.sid, { p: Math.max(0, Number(event.target.value) || 0) })}
                      className="mt-1 w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                      aria-label={`Permit holders needed for ${section.sname}`}
                    />
                  </div>
                </div>

                {hasProgramme && (
                  <ul className="mt-3 divide-y divide-gray-100">
                    {visibleMeetings.map((meeting) => (
                      <li key={meeting.date} className="flex items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          id={`meeting-${section.sid}-${meeting.date}`}
                          checked={!plan.excluded[meeting.date]}
                          onChange={(event) =>
                            updatePlan(section.sid, {
                              excluded: { ...plan.excluded, [meeting.date]: !event.target.checked },
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-scout-blue focus:ring-scout-blue"
                        />
                        <label
                          htmlFor={`meeting-${section.sid}-${meeting.date}`}
                          className="flex-1 text-sm text-gray-700"
                        >
                          <span className="font-medium">{format(parseISO(meeting.date), 'EEE d MMM')}</span>
                          {meeting.startTime && (
                            <span className="ml-2 text-gray-500">{meeting.startTime}</span>
                          )}
                          {meeting.title && (
                            <span className="ml-2 text-gray-400">{meeting.title}</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700"
            >
              Back
            </button>
            <button
              type="button"
              disabled={allSessions.length === 0}
              onClick={() => setStep(3)}
              className="flex-1 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark disabled:opacity-50"
            >
              Next: preview
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-gray-700">
            This creates <span className="font-semibold">{allSessions.length} sessions</span> across{' '}
            <span className="font-semibold">{bucketSessionsByWeek(allSessions).length} weeks</span> in{' '}
            <span className="font-semibold">{hostSection?.sectionname}</span>&apos;s{' '}
            <span className="font-mono text-xs">Viking Water Rota {year}</span> record.
            Sessions can be edited or marked not-on-water later, but can&apos;t be deleted.
          </p>

          <ul className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            {bucketSessionsByWeek(allSessions).map(({ weekStart, sessions: weekSessions }) => (
              <li key={weekStart} className="px-3 py-2">
                <span className="font-medium text-gray-700">Week of {format(parseISO(weekStart), 'd MMM')}</span>
                <span className="ml-2 text-gray-500">
                  {weekSessions.map((session) => `${session.sectionName} ${format(parseISO(session.date), 'EEE')}`).join(' · ')}
                </span>
              </li>
            ))}
          </ul>

          {creationErrors.length > 0 && (
            <div className="rounded-lg border border-scout-red bg-scout-red/5 p-3 text-sm">
              <p className="font-medium text-scout-red">
                {creationErrors.length} step{creationErrors.length === 1 ? '' : 's'} failed — creation is resumable, retry to finish.
              </p>
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
                {creationErrors.map((entry, index) => (
                  <li key={index}>{entry.field}: {entry.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={creating}
              onClick={() => setStep(2)}
              className="flex-1 py-2.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="flex-1 py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark disabled:opacity-50"
            >
              {creating ? 'Creating…' : creationErrors.length > 0 ? 'Retry' : 'Create rota'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RotaSetupWizard;
