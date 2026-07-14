import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import databaseService from '../../../../shared/services/storage/database.js';
import { CurrentActiveTermsService } from '../../../../shared/services/storage/currentActiveTermsService.js';
import { getToken } from '../../../../shared/services/auth/tokenService.js';
import { notifyError, notifySuccess } from '../../../../shared/utils/notifications.js';
import LoadingScreen from '../../../../shared/components/LoadingScreen.jsx';
import logger, { LOG_CATEGORIES } from '../../../../shared/services/utils/logger.js';
import { fetchProgrammeMeetings } from '../../services/programmeService.js';
import { getTerms } from '../../../../shared/services/api/api/index.js';
import { createOrCompleteRota, writeRotaConfig } from '../../services/rotaSetupService.js';
import { discoverRotaRecords, findHostSection, loadRota, prefillRegulars } from '../../services/rotaService.js';
import { ACTIVITY_PRESETS, DEFAULT_PERMIT_HOLDERS, DEFAULT_SESSION_TIMES, guessActivityFromTitle, looksLikeWaterSession, seasonBucketForRange } from '../../services/rotaTemplates.js';
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
 * Default plan used until the leader adjusts it.
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
 * Build session descriptors for the planning section from its plan:
 * programme meetings (minus unticked ones) when the programme has any,
 * otherwise the weekly slot fallback.
 *
 * @param {Object} section - {sid, sname}
 * @param {Object} plan - Plan state
 * @param {{start: string, end: string}} range - Rota date range
 * @returns {Array} Session descriptors
 */
function sessionsForPlan(section, plan, range) {
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
 * Sections that never plan their own rota: waiting lists (no programme) and
 * the Adults host itself (it only ever hosts other sections' records).
 *
 * @param {Object} section - Cached section
 * @returns {boolean} True when the section is a waiting list
 */
function isWaitingList(section) {
  return /waiting/i.test(`${section.section ?? ''} ${section.sectiontype ?? ''} ${section.sectionname ?? ''}`);
}

/**
 * Three-step wizard creating (or completing) ONE planning section's own rota
 * record, hosted in the Adults section: (1) section + its own term + date
 * range; (2) programme review for that section only, with on-water
 * checkboxes per meeting (weekly-slot fallback for an empty programme); (3)
 * preview and resumable creation, followed by the plan-config write and
 * regular pre-fill. Re-running against a section/term that already has a
 * record seeds the wizard from its existing config. A `?section=<sectionid>`
 * query param (as set by the board's "Edit plan" link) pre-selects that
 * section on load when it's one of the leader's cached sections; otherwise
 * the usual first-youth-section default applies.
 *
 * @returns {JSX.Element} Setup wizard page
 */
function RotaSetupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = getToken();

  const [step, setStep] = useState(1);
  const [sections, setSections] = useState(null);
  const [descriptors, setDescriptors] = useState([]);
  const [sectionId, setSectionId] = useState(null);
  const [range, setRange] = useState({ start: '', end: '' });
  const [terms, setTerms] = useState(null);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [plan, setPlan] = useState(defaultPlan());
  const [loadingProgramme, setLoadingProgramme] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationErrors, setCreationErrors] = useState([]);
  const seededKeyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const cached = (await databaseService.getSections()) || [];
      const discovered = await discoverRotaRecords(token).catch((error) => {
        logger.warn('Setup: could not check for existing rota records', {
          error: error.message,
        }, LOG_CATEGORIES.APP);
        return [];
      });
      if (cancelled) {
        return;
      }
      setSections(cached);
      setDescriptors(discovered);
      const requestedSectionId = searchParams.get('section');
      const requested = requestedSectionId
        && cached.find((section) => String(section.sectionid) === requestedSectionId);
      if (requested) {
        setSectionId(String(requested.sectionid));
        return;
      }
      const host = findHostSection(cached);
      const firstYouth = cached.find(
        (section) => (!host || section.sectionid !== host.sectionid) && !isWaitingList(section),
      );
      if (firstYouth) {
        setSectionId(String(firstYouth.sectionid));
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostSection = useMemo(() => findHostSection(sections ?? []), [sections]);

  const section = useMemo(() => {
    if (!sectionId || !sections) {
      return null;
    }
    const found = sections.find((s) => String(s.sectionid) === sectionId);
    return found ? { sid: sectionId, sname: found.sectionname } : null;
  }, [sectionId, sections]);

  const existingDescriptor = useMemo(
    () => descriptors.find((d) => d.sectionId === sectionId && d.termId === selectedTermId) ?? null,
    [descriptors, sectionId, selectedTermId],
  );

  // Load the planning section's own terms, defaulting the selection + range
  // to its current active term. Switching sections re-picks from scratch.
  useEffect(() => {
    let cancelled = false;
    async function loadTermsForSection() {
      if (!sectionId) {
        return;
      }
      setSelectedTermId('');
      setRange({ start: '', end: '' });
      seededKeyRef.current = null;
      let list = [];
      try {
        const all = await getTerms(token);
        list = (all?.[sectionId] ?? [])
          .filter((term) => term.startdate && term.enddate)
          .sort((a, b) => a.startdate.localeCompare(b.startdate));
      } catch {
        /* offline or fetch failed — the leader can still type dates below */
      }
      if (cancelled) {
        return;
      }
      setTerms(list);
      if (list.length === 0) {
        return;
      }
      let current = null;
      try {
        current = await CurrentActiveTermsService.getCurrentActiveTerm(sectionId);
      } catch {
        /* no cached current term — fall back to the latest term */
      }
      const chosen = list.find((term) => String(term.termid) === String(current?.currentTermId))
        ?? list[list.length - 1];
      if (!cancelled && chosen) {
        setSelectedTermId(String(chosen.termid));
        setRange({ start: chosen.startdate.slice(0, 10), end: chosen.enddate.slice(0, 10) });
      }
    }
    loadTermsForSection();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // Re-edit: seed the wizard from the existing record's config when the
  // chosen (section, term) already has one, so prior choices aren't lost.
  useEffect(() => {
    let cancelled = false;
    async function seedFromExisting() {
      if (!existingDescriptor) {
        return;
      }
      const seedKey = `${existingDescriptor.sectionId}.${existingDescriptor.termId}`;
      if (seededKeyRef.current === seedKey) {
        return;
      }
      try {
        const existing = await loadRota(existingDescriptor, token);
        const cfg = existing?.config?.cfg;
        if (cancelled) {
          return;
        }
        seededKeyRef.current = seedKey;
        if (!cfg) {
          return;
        }
        if (cfg.start && cfg.end) {
          setRange({ start: cfg.start.slice(0, 10), end: cfg.end.slice(0, 10) });
        }
        // Reconstruct which meeting dates were marked not-on-water (config
        // holds those as {c:1}); on-water weeks were columns, not in config.
        const excluded = {};
        for (const [colName, override] of Object.entries(cfg.sessions ?? {})) {
          if (override?.c === 1) {
            const parsed = parseSessionColumnName(colName);
            if (parsed) {
              excluded[parsed.date] = true;
            }
          }
        }
        setPlan((previous) => ({
          ...previous,
          act: cfg.act ?? previous.act,
          st: cfg.st ?? previous.st,
          en: cfg.en ?? previous.en,
          k: cfg.k ?? previous.k,
          p: cfg.p ?? previous.p,
          regulars: Array.isArray(cfg.regulars) ? cfg.regulars : previous.regulars,
          excluded,
        }));
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
  }, [existingDescriptor, token]);

  const { counts: ypCounts } = useSectionYPCounts(sectionId ? [sectionId] : []);
  const { candidates: leaderCandidates } = useSectionLeaders(
    sectionId ? [sectionId] : [],
    hostSection?.sectionid ?? null,
  );
  const ypCount = sectionId ? ypCounts[sectionId] : undefined;
  const regularCandidates = sectionId ? leaderCandidates[sectionId] ?? [] : [];

  const allSessions = useMemo(
    // section can resolve a render before the term-loading effect populates
    // range (both setSectionId and the term fetch fire off the same init
    // effect), so guard against computing sessions off an empty date range —
    // expandWeeklySlot/generateSessionsFromProgramme throw on invalid dates.
    () => (section && range.start && range.end ? sessionsForPlan(section, plan, range) : []),
    [section, plan, range],
  );
  // Only water sessions get signup columns; not-on-water weeks live in config.
  const waterSessions = useMemo(() => allSessions.filter((s) => s.onWater !== false), [allSessions]);

  const hasProgramme = plan.meetings && plan.meetings.length > 0;
  const visibleMeetings = (plan.meetings ?? []).filter(
    (meeting) => meeting.date >= range.start && meeting.date <= range.end,
  );

  const seasonBucket = range.start && range.end ? seasonBucketForRange(range.start, range.end) : null;

  const startProgrammeReview = async () => {
    setLoadingProgramme(true);
    try {
      // Fetch the programme under the exact term chosen in step 1 — the
      // record's own planning term, not a fresh "current active term" lookup.
      const meetings = selectedTermId
        ? await fetchProgrammeMeetings(sectionId, selectedTermId, token)
        : [];
      // Pre-select only the water nights: most programme meetings are not on
      // the water, so default non-water meetings to excluded rather than
      // making the leader untick most of them. On re-edit, the config's saved
      // not-on-water dates (seeded into plan.excluded) win over the heuristic.
      const heuristicExcluded = Object.fromEntries(
        meetings
          .filter((meeting) => !looksLikeWaterSession(meeting.title))
          .map((meeting) => [meeting.date, true]),
      );
      const excluded = existingDescriptor
        ? { ...heuristicExcluded, ...(plan.excluded ?? {}) }
        : heuristicExcluded;
      setPlan((previous) => ({ ...previous, k: previous.k ?? ypCount ?? null, meetings, excluded }));
    } catch (error) {
      logger.warn('Programme fetch failed during setup', {
        sectionId,
        error: error.message,
      }, LOG_CATEGORIES.API);
      setPlan((previous) => ({ ...previous, k: previous.k ?? ypCount ?? null, meetings: [] }));
    }
    setLoadingProgramme(false);
    setStep(2);
  };

  const updatePlan = (patch) => {
    setPlan((previous) => ({ ...previous, ...patch }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreationErrors([]);
    try {
      const hostTerm = await CurrentActiveTermsService.getCurrentActiveTerm(hostSection.sectionid);
      const hostTermId = hostTerm?.currentTermId;
      if (!hostTermId) {
        setCreationErrors([{ field: '_meta', error: 'No active term found for the host section' }]);
        return;
      }

      const record = { sectionId: section.sid, sectionName: section.sname, termId: selectedTermId, seasonBucket };
      const result = await createOrCompleteRota({
        hostSection,
        hostTermId,
        record,
        sessions: waterSessions,
        token,
      });

      if (!result.success) {
        setCreationErrors(result.errors ?? [{ field: '_meta', error: 'Unknown creation failure' }]);
        return;
      }

      const descriptor = { recordId: result.flexirecordid, hostSection, ...record };
      const rota = await loadRota(descriptor, token, { forceRefresh: true });
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
      const sectionDefault = {
        sid: section.sid,
        sname: section.sname,
        act: plan.act,
        st: plan.st,
        en: plan.en,
        k: plan.k ?? ypCount ?? 0,
        p: plan.p ?? DEFAULT_PERMIT_HOLDERS,
        regulars: plan.regulars ?? [],
      };
      await writeRotaConfig({
        hostSection,
        recordId: rota.recordId,
        termId: rota.termId,
        scoutid: configRow.scoutid,
        by,
        cfg: {
          ...sectionDefault,
          start: range.start,
          end: range.end,
          sessions: buildSessionOverrides(allSessions, [sectionDefault]),
        },
        token,
      });

      // Pre-fill the section's regulars as confirmed signups — but only on
      // sessions whose column was just created this run. Re-touching existing
      // sessions would clobber people's withdrawals on a plan re-edit.
      const newlyAdded = new Set(result.addedFields ?? []);
      const newSessions = rota.sessions.filter(
        (s) => s.fieldId && newlyAdded.has(buildSessionColumnName(s.date, s.sectionId)),
      );
      if ((plan.regulars ?? []).length > 0 && newSessions.length > 0) {
        const { errors } = await prefillRegulars({
          rota,
          regularsBySection: { [section.sid]: plan.regulars ?? [] },
          token,
          sessions: newSessions,
        });
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

  if (!hostSection) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold text-gray-900">Set up the water rota</h1>
        <p className="mt-3 rounded-lg border border-scout-red bg-scout-red/5 p-3 text-sm text-scout-red">
          No Adults section was found. The rota needs an Adults section to host the roster every permit
          holder signs up from — ask an admin to check your section access.
        </p>
      </div>
    );
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
              Every rota record lives here so any permit holder can sign up for any section&apos;s sessions.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900">{hostSection.sectionname}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="rota-section">Section</label>
            <p className="text-xs text-gray-500">Sets up (or completes) this section&apos;s own rota record only.</p>
            <select
              id="rota-section"
              value={sectionId ?? ''}
              onChange={(event) => setSectionId(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
            >
              <option value="" disabled>Choose a section…</option>
              {sections.map((s) => (
                <option key={s.sectionid} value={String(s.sectionid)}>
                  {s.sectionname}
                </option>
              ))}
            </select>
            {existingDescriptor && (
              <p className="mt-1.5 text-xs text-scout-blue">
                This section already has a rota for this term — continuing will edit it.
              </p>
            )}
          </div>

          {terms && terms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="rota-term">Term</label>
              <select
                id="rota-term"
                value={selectedTermId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSelectedTermId(id);
                  const term = terms.find((entry) => String(entry.termid) === id);
                  if (term) {
                    setRange({ start: term.startdate.slice(0, 10), end: term.enddate.slice(0, 10) });
                  }
                }}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-scout-blue focus:outline-none"
              >
                {terms.map((term) => (
                  <option key={term.termid} value={term.termid}>
                    {term.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Picks the weeks below — fine-tune them if the rota runs a shorter span.</p>
            </div>
          )}

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
            disabled={!section || !selectedTermId || !range.start || !range.end || range.end < range.start || loadingProgramme}
            onClick={startProgrammeReview}
            className="w-full py-2.5 rounded-md bg-scout-blue text-white text-sm font-semibold hover:bg-scout-blue-dark disabled:opacity-50"
          >
            {loadingProgramme ? 'Reading programme…' : 'Next: review programme'}
          </button>
        </div>
      )}

      {step === 2 && section && (
        <div className="mt-5 space-y-6">
          <section className="rounded-lg border border-gray-200 p-4">
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
                  onChange={(event) => updatePlan({ act: event.target.value })}
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
                  onChange={(event) => updatePlan({ st: event.target.value })}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">End</label>
                <input
                  type="time"
                  value={plan.en}
                  onChange={(event) => updatePlan({ en: event.target.value })}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-scout-blue focus:outline-none"
                />
              </div>
              {!hasProgramme && (
                <div>
                  <label className="block text-xs font-medium text-gray-600">Evening</label>
                  <select
                    value={plan.slotWeekday}
                    onChange={(event) => updatePlan({ slotWeekday: Number(event.target.value) })}
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
                  value={plan.k ?? ypCount ?? 0}
                  onChange={(event) => updatePlan({ k: Math.max(0, Number(event.target.value) || 0) })}
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
                  onChange={(event) => updatePlan({ p: Math.max(0, Number(event.target.value) || 0) })}
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
              {regularCandidates.length === 0 ? (
                <p className="mt-1 text-xs text-gray-400 italic">
                  No leaders found in both {section.sname} and the host section.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {regularCandidates.map((candidate) => {
                    const on = (plan.regulars ?? []).includes(candidate.scoutid);
                    return (
                      <button
                        key={candidate.scoutid}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          updatePlan({
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
                        id={`meeting-${meeting.date}`}
                        checked={included}
                        onChange={(event) =>
                          updatePlan({
                            excluded: { ...plan.excluded, [meeting.date]: !event.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-scout-blue focus:ring-scout-blue"
                      />
                      <label
                        htmlFor={`meeting-${meeting.date}`}
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
                          updatePlan({
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

      {step === 3 && section && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-gray-700">
            This creates <span className="font-semibold">{waterSessions.length} water session{waterSessions.length === 1 ? '' : 's'}</span> permit holders can sign up to, across{' '}
            <span className="font-semibold">{bucketSessionsByWeek(waterSessions).length} weeks</span> for{' '}
            <span className="font-semibold">{section.sname}</span>&apos;s <span className="font-semibold">{seasonBucket}</span> rota.
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
                  {weekSessions.map((s) => format(parseISO(s.date), 'EEE')).join(' · ')}
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
