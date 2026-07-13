import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { loadRota, prefillRegulars } from '../../services/rotaService.js';
import { ACTIVITY_PRESETS, DEFAULT_PERMIT_HOLDERS, DEFAULT_SESSION_TIMES, guessActivityFromTitle, looksLikeWaterSession } from '../../services/rotaTemplates.js';
import { buildSessionColumnName, parseSessionColumnName } from '../../services/rotaEncoding.js';
import { expandWeeklySlot, generateSessionsFromProgramme, bucketSessionsByWeek } from '../../utils/rotaDates.js';
import { buildSessionOverrides } from '../../utils/rotaSetupPlan.js';
import { getCurrentUserName } from '../../hooks/useRotaIdentity.js';
import { useSectionYPCounts } from '../../hooks/useSectionYPCounts.js';
import { useSectionLeaders } from '../../hooks/useSectionLeaders.js';
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
    regulars: [],
    meetings: null,
    excluded: {},
    meetingActivity: {},
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
    // Every programme meeting becomes a session; onWater (checkbox) decides
    // whether it gets a signup column or is shown as not-on-water.
    return generateSessionsFromProgramme(plan.meetings, sectionCfg, range).map((descriptor) => {
      const chosen = plan.meetingActivity?.[descriptor.date];
      return {
        ...descriptor,
        activity: chosen ?? descriptor.activity,
        onWater: !plan.excluded[descriptor.date],
      };
    });
  }
  return expandWeeklySlot({ weekday: plan.slotWeekday, ...sectionCfg }, range).map((d) => ({ ...d, onWater: true }));
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
  const [activeSectionSid, setActiveSectionSid] = useState(null);
  const seededFromConfig = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const cached = (await databaseService.getSections()) || [];
      if (cancelled) {
        return;
      }
      setSections(cached);
      const isWaitingList = (section) =>
        /waiting/i.test(`${section.section ?? ''} ${section.sectiontype ?? ''} ${section.sectionname ?? ''}`);
      const isAdults = (section) =>
        `${section.section ?? ''} ${section.sectionname ?? ''}`.toLowerCase().includes('adult');

      const adults = cached.find(isAdults);
      if (adults) {
        setHostSectionId(String(adults.sectionid));
      }
      // Auto-select the youth sections that actually run programmes — not the
      // Adults host, and not waiting lists (which have no meetings and would
      // otherwise generate a full year of weekly-slot sessions).
      const youthSections = cached.filter(
        (section) => !isAdults(section) && !isWaitingList(section),
      );
      setSelectedIds(Object.fromEntries(youthSections.map((section) => [String(section.sectionid), true])));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // On "Edit plan", seed the wizard from the existing rota so prior choices
  // (regulars, section defaults, date range, not-on-water weeks) are not lost.
  useEffect(() => {
    let cancelled = false;
    async function seedFromExisting() {
      if (!sections || seededFromConfig.current) {
        return;
      }
      try {
        const existing = await loadRota(new Date().getFullYear(), token);
        const cfg = existing?.config?.cfg;
        if (cancelled || !cfg || !Array.isArray(cfg.sections) || cfg.sections.length === 0) {
          return;
        }
        seededFromConfig.current = true;

        if (existing.hostSection) {
          setHostSectionId(String(existing.hostSection.sectionid));
        }
        if (cfg.start && cfg.end) {
          setRange({ start: cfg.start.slice(0, 10), end: cfg.end.slice(0, 10) });
        }
        setSelectedIds(Object.fromEntries(cfg.sections.map((s) => [String(s.sid), true])));

        // Reconstruct which meeting dates were marked not-on-water (config
        // holds those as {c:1}); on-water weeks were columns, not in config.
        const offBySection = {};
        for (const [colName, override] of Object.entries(cfg.sessions ?? {})) {
          if (override?.c === 1) {
            const parsed = parseSessionColumnName(colName);
            if (parsed) {
              (offBySection[parsed.sectionId] ??= {})[parsed.date] = true;
            }
          }
        }

        setPlans(Object.fromEntries(cfg.sections.map((s) => [
          String(s.sid),
          {
            ...defaultPlan(),
            act: s.act ?? ACTIVITY_PRESETS[0],
            st: s.st ?? DEFAULT_SESSION_TIMES.start,
            en: s.en ?? DEFAULT_SESSION_TIMES.end,
            k: s.k ?? null,
            p: s.p ?? DEFAULT_PERMIT_HOLDERS,
            regulars: Array.isArray(s.regulars) ? s.regulars : [],
            excluded: offBySection[String(s.sid)] ?? {},
          },
        ])));
      } catch (error) {
        logger.warn('Setup: no existing rota to seed from', {
          error: error.message,
        }, LOG_CATEGORIES.APP);
      }
    }
    seedFromExisting();
    return () => {
      cancelled = true;
    };
  }, [sections]);

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

  const rangeSourceSid = participating[0]?.sid ?? hostSectionId;

  useEffect(() => {
    let cancelled = false;
    async function defaultRange() {
      if (!rangeSourceSid || range.start) {
        return;
      }
      try {
        // Prefer a youth section's term: it's the real school term (~summer),
        // whereas the Adults host term often spans a full year.
        const term = await CurrentActiveTermsService.getCurrentActiveTerm(rangeSourceSid);
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
  }, [rangeSourceSid, range.start]);

  const participatingSids = useMemo(() => participating.map((section) => section.sid), [participating]);
  const { counts: ypCounts } = useSectionYPCounts(participatingSids);
  const { candidates: leaderCandidates } = useSectionLeaders(participatingSids, hostSectionId);

  const activeSid = participating.some((s) => s.sid === activeSectionSid)
    ? activeSectionSid
    : participating[0]?.sid ?? null;
  const activeSection = participating.find((s) => s.sid === activeSid) ?? null;

  const allSessions = useMemo(
    () =>
      participating.flatMap((section) =>
        plans[section.sid] ? sessionsForSection(section, plans[section.sid], range) : [],
      ),
    [participating, plans, range],
  );
  // Only water sessions get signup columns; not-on-water weeks live in config.
  const waterSessions = useMemo(() => allSessions.filter((s) => s.onWater !== false), [allSessions]);

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
        // Pre-select only the water nights: most programme meetings are not
        // on the water, so default non-water meetings to excluded rather than
        // making the leader untick ~10 of 14. On re-edit, the config's saved
        // not-on-water dates (seeded into plan.excluded) win over the heuristic.
        const heuristicExcluded = Object.fromEntries(
          meetings
            .filter((meeting) => !looksLikeWaterSession(meeting.title))
            .map((meeting) => [meeting.date, true]),
        );
        const excluded = seededFromConfig.current
          ? { ...heuristicExcluded, ...(plan.excluded ?? {}) }
          : heuristicExcluded;
        nextPlans[section.sid] = { ...withKids, meetings, excluded };
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
        sessions: waterSessions,
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
      const sectionDefaults = participating.map((section) => {
        const plan = plans[section.sid];
        return {
          sid: section.sid,
          sname: section.sname,
          act: plan.act,
          st: plan.st,
          en: plan.en,
          k: plan.k ?? ypCounts[section.sid] ?? 0,
          p: plan.p ?? DEFAULT_PERMIT_HOLDERS,
          regulars: plan.regulars ?? [],
        };
      });
      await writeRotaConfig({
        hostSection,
        recordId: result.flexirecordid,
        termId: rota.termId,
        scoutid: configRow.scoutid,
        by,
        cfg: {
          start: range.start,
          end: range.end,
          sections: sectionDefaults,
          sessions: buildSessionOverrides(allSessions, sectionDefaults),
        },
        token,
      });

      // Pre-fill each section's regulars as confirmed signups — but only on
      // sessions whose column was just created this run. Re-touching existing
      // sessions would clobber people's withdrawals on a plan re-edit.
      const regularsBySection = Object.fromEntries(
        participating.map((section) => [section.sid, plans[section.sid]?.regulars ?? []]),
      );
      const newlyAdded = new Set(result.addedFields ?? []);
      const newSessions = rota.sessions.filter(
        (session) => session.fieldId && newlyAdded.has(buildSessionColumnName(session.date, session.sectionId)),
      );
      const hasRegulars = Object.values(regularsBySection).some((list) => list.length > 0);
      if (hasRegulars && newSessions.length > 0) {
        const { errors } = await prefillRegulars({ rota, regularsBySection, token, sessions: newSessions });
        if (errors.length > 0) {
          notifyError(`Rota saved, but ${errors.length} session${errors.length === 1 ? '' : 's'} couldn't be pre-filled with regulars — open them to add manually.`);
        }
      }

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
          <div className="flex flex-wrap gap-1.5">
            {participating.map((section) => {
              const active = section.sid === activeSid;
              return (
                <button
                  key={section.sid}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveSectionSid(section.sid)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    active
                      ? sectionChipClass(section.sname) + ' border-transparent'
                      : 'bg-white border-gray-300 text-gray-500'
                  }`}
                >
                  {section.sname}
                </button>
              );
            })}
          </div>

          {activeSection && plans[activeSection.sid] && (() => {
            const section = activeSection;
            const plan = plans[section.sid];
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
                      ? `${visibleMeetings.filter((m) => !plan.excluded[m.date]).length} water night${
                        visibleMeetings.filter((m) => !plan.excluded[m.date]).length === 1 ? '' : 's'
                      } selected of ${visibleMeetings.length} programme meetings`
                      : 'No programme found — using a weekly slot'}
                  </span>
                </h2>
                {hasProgramme && (
                  <p className="mt-1 text-xs text-gray-400">
                    Water nights are auto-picked from the meeting name; tick or untick any.
                    Times aren&apos;t in the OSM programme, so the section time below is used.
                  </p>
                )}

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

                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600">
                    Regular permit holders
                    <span className="ml-1 font-normal text-gray-400">
                      (pre-filled as confirmed on every session; gaps = extras you still need)
                    </span>
                  </label>
                  {(leaderCandidates[section.sid] ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-gray-400 italic">
                      No leaders found in both {section.sname} and the host section.
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(leaderCandidates[section.sid] ?? []).map((candidate) => {
                        const on = (plan.regulars ?? []).includes(candidate.scoutid);
                        return (
                          <button
                            key={candidate.scoutid}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              updatePlan(section.sid, {
                                regulars: on
                                  ? (plan.regulars ?? []).filter((id) => id !== candidate.scoutid)
                                  : [...(plan.regulars ?? []), candidate.scoutid],
                              })
                            }
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${
                              on
                                ? 'bg-scout-blue border-scout-blue text-white'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-scout-blue'
                            }`}
                          >
                            {on ? '✓ ' : ''}{candidate.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {hasProgramme && (
                  <ul className="mt-3 divide-y divide-gray-100">
                    {visibleMeetings.map((meeting) => {
                      const included = !plan.excluded[meeting.date];
                      const activity = plan.meetingActivity?.[meeting.date]
                        ?? guessActivityFromTitle(meeting.title)
                        ?? plan.act;
                      const isCustomActivity = !ACTIVITY_PRESETS.includes(activity);
                      return (
                        <li key={meeting.date} className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            id={`meeting-${section.sid}-${meeting.date}`}
                            checked={included}
                            onChange={(event) =>
                              updatePlan(section.sid, {
                                excluded: { ...plan.excluded, [meeting.date]: !event.target.checked },
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-scout-blue focus:ring-scout-blue"
                          />
                          <label
                            htmlFor={`meeting-${section.sid}-${meeting.date}`}
                            className="min-w-0 flex-1 text-sm text-gray-700"
                          >
                            <span className="flex items-baseline gap-2 whitespace-nowrap">
                              <span className="font-medium">{format(parseISO(meeting.date), 'EEE d MMM')}</span>
                              {meeting.startTime && (
                                <span className="text-gray-500">
                                  {meeting.startTime}
                                  {meeting.endTime ? `–${meeting.endTime}` : ''}
                                </span>
                              )}
                            </span>
                            {meeting.title && (
                              <span className="block text-xs text-gray-500 truncate">{meeting.title}</span>
                            )}
                          </label>
                          <select
                            value={activity}
                            disabled={!included}
                            onChange={(event) =>
                              updatePlan(section.sid, {
                                meetingActivity: { ...plan.meetingActivity, [meeting.date]: event.target.value },
                              })
                            }
                            className="ml-auto w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-scout-blue focus:outline-none disabled:opacity-40"
                            aria-label={`Activity for ${format(parseISO(meeting.date), 'd MMM')}`}
                          >
                            {isCustomActivity && <option value={activity}>{activity}</option>}
                            {ACTIVITY_PRESETS.map((preset) => (
                              <option key={preset} value={preset}>{preset}</option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })()}

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
            This creates <span className="font-semibold">{waterSessions.length} water session{waterSessions.length === 1 ? '' : 's'}</span> permit holders can sign up to, across{' '}
            <span className="font-semibold">{bucketSessionsByWeek(waterSessions).length} weeks</span> in{' '}
            <span className="font-semibold">{hostSection?.sectionname}</span>&apos;s{' '}
            <span className="font-mono text-xs">Viking Water Rota {year}</span> record.
            {allSessions.length > waterSessions.length && (
              <> The other <span className="font-semibold">{allSessions.length - waterSessions.length}</span> programme
              weeks show as not-on-water. Sessions can be edited later, but signup columns can&apos;t be deleted.</>
            )}
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
