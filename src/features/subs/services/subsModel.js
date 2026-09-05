/**
 * Pure derivations for the subs monitoring feature: turns the raw OSM
 * payment-scheme and payment-status responses, plus the section's cached
 * members and terms, into the SectionSubsSummary the pages render.
 *
 * Nothing here touches storage, the network or the clock — `today` and
 * `loadedAt` are always injected, so every rule is directly testable against
 * the anonymised fixtures.
 *
 * @module subsModel
 */

import { findMostRecentTerm } from '../../../shared/utils/termUtils.js';

export const RECENT_TERM_GRACE_DAYS = 120;

const PAID_STATUSES = new Set(['Paid', 'Received', 'Paid manually']);
const IN_PROGRESS_STATUSES = new Set(['Initiated', 'Submitted']);
const NOT_REQUIRED_STATUS = 'Payment not required';
const REQUIRED_STATUS = 'Payment required';
const YOUNG_PEOPLE = 'Young People';

/**
 * A term bucket used for grouping payments.
 *
 * @typedef {Object} SubsTerm
 * @property {string} termId - OSM term id
 * @property {string} name - Term name
 * @property {string} startDate - Inclusive start date (yyyy-mm-dd)
 * @property {string} endDate - Inclusive end date (yyyy-mm-dd)
 */

/**
 * The current status entry for a payment: the one flagged `latest === '1'`,
 * falling back to the first entry (the history is newest first).
 *
 * @param {Object|null|undefined} paymentObj - Per-payment object from the payload=1 response
 * @returns {Object|null} The current status entry, or null when there is no history
 */
export function latestStatusEntry(paymentObj) {
  const history = Array.isArray(paymentObj?.status) ? paymentObj.status : [];
  if (history.length === 0) {
    return null;
  }
  return history.find((entry) => entry?.latest === '1') ?? history[0];
}

/**
 * Classifies one member's state for one payment.
 *
 * @param {Object|null|undefined} paymentObj - Per-payment object from the payload=1 response
 * @returns {'not-applicable'|'paid'|'not-required'|'in-progress'|'required'|'not-started'|'unknown'} The payment state
 */
export function classifyPaymentState(paymentObj) {
  if (!paymentObj || paymentObj.active === false || paymentObj.defaulton === false) {
    return 'not-applicable';
  }
  const latest = latestStatusEntry(paymentObj);
  if (!latest) {
    return 'not-started';
  }
  const status = latest.status;
  if (PAID_STATUSES.has(status)) {
    return 'paid';
  }
  if (status === NOT_REQUIRED_STATUS) {
    return 'not-required';
  }
  if (IN_PROGRESS_STATUSES.has(status)) {
    return 'in-progress';
  }
  if (status === REQUIRED_STATUS) {
    return 'required';
  }
  return 'unknown';
}

/**
 * Which term bucket a payment date falls into.
 *
 * @param {string|null|undefined} date - Payment date (yyyy-mm-dd)
 * @param {{previous: SubsTerm|null, current: SubsTerm|null, next: SubsTerm|null}} terms - Term buckets
 * @returns {'previous'|'current'|'next'|null} The bucket, or null when the date is outside all three
 */
export function bucketPaymentDate(date, terms) {
  if (!date) {
    return null;
  }
  for (const bucket of ['previous', 'current', 'next']) {
    const term = terms?.[bucket];
    if (term && date >= term.startDate && date <= term.endDate) {
      return bucket;
    }
  }
  return null;
}

/**
 * Normalises an OSM term row into a {@link SubsTerm}.
 *
 * @param {Object|null|undefined} term - Cached term row
 * @returns {SubsTerm|null} Normalised term, or null when unusable
 */
function normaliseTerm(term) {
  if (!term || !term.startdate || !term.enddate) {
    return null;
  }
  return {
    termId: String(term.termid),
    name: term.name ?? '',
    startDate: String(term.startdate),
    endDate: String(term.enddate),
  };
}

/**
 * Derives the previous / current / next term buckets from a section's cached
 * terms. Current is the term containing today, falling back to the most
 * recently ended term when that was within the last
 * {@link RECENT_TERM_GRACE_DAYS} days; otherwise there is no current term.
 *
 * @param {Array<Object>} sectionTerms - Cached terms for the section
 * @param {string} today - Today's date (yyyy-mm-dd)
 * @returns {{previous: SubsTerm|null, current: SubsTerm|null, next: SubsTerm|null}} The three buckets
 */
/**
 * Whole days between two yyyy-mm-dd dates.
 *
 * @param {string} from - Earlier date
 * @param {string} to - Later date
 * @returns {number} Days from `from` to `to`
 */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * The term with the latest end date, normalised.
 *
 * @param {Array<Object>} sectionTerms - Cached terms for the section
 * @returns {SubsTerm|null} The most recent term, or null when there are none
 */
export function mostRecentTerm(sectionTerms) {
  const usable = (Array.isArray(sectionTerms) ? sectionTerms : []).filter((term) => term?.enddate);
  if (usable.length === 0) {
    return null;
  }
  return normaliseTerm(findMostRecentTerm(usable));
}

export function deriveTerms(sectionTerms, today) {
  const terms = (Array.isArray(sectionTerms) ? sectionTerms : [])
    .map(normaliseTerm)
    .filter(Boolean)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (terms.length === 0) {
    return { previous: null, current: null, next: null };
  }

  // Between terms (school holidays) the most recently ended term still
  // describes the subs that are live, but a term that ended years ago does
  // not: a dormant section must resolve to no current term rather than
  // reporting stale coverage.
  const containing = terms.find((term) => today >= term.startDate && today <= term.endDate);
  const recentlyEnded = terms
    .filter((term) => term.endDate < today && daysBetween(term.endDate, today) <= RECENT_TERM_GRACE_DAYS)
    .reduce((latest, term) => (!latest || term.endDate > latest.endDate ? term : latest), null);
  const current = containing ?? recentlyEnded;

  if (!current) {
    return { previous: null, current: null, next: null };
  }

  const previous = terms
    .filter((term) => term.endDate < current.startDate)
    .reduce((latest, term) => (!latest || term.endDate > latest.endDate ? term : latest), null);
  const next = terms.find((term) => term.startDate > current.endDate) ?? null;

  return { previous, current, next };
}

/**
 * Indexes the section's cached members by scoutid, recording whether each is
 * a Young Person in THIS section (the same per-section membership rule as
 * useSectionYPCounts). Non-YP cached members are kept so a status-response
 * member can be reported as a known adult rather than as unknown.
 *
 * @param {Array<Object>} members - Cached member records
 * @param {string|number} sectionId - Section being summarised
 * @returns {Map<string, {member: Object, isYP: boolean}>} scoutid to cached member and YP flag
 */
function indexCachedMembers(members, sectionId) {
  const wanted = String(sectionId);
  const result = new Map();
  for (const member of members ?? []) {
    const sections = Array.isArray(member?.sections) ? member.sections : [];
    const membership = sections.find((entry) => String(entry.sectionid) === wanted);
    if (!membership) {
      continue;
    }
    result.set(String(member.scoutid), { member, isYP: membership.person_type === YOUNG_PEOPLE });
  }
  return result;
}

/**
 * The payment ids present on a status-response member row (numeric keys).
 *
 * @param {Object} member - Member row from the payload=1 response
 * @returns {string[]} Payment ids
 */
function paymentKeys(member) {
  return Object.keys(member ?? {}).filter((key) => /^\d+$/.test(key));
}

/**
 * Builds one scheme's summary from its status response.
 *
 * @param {Object} scheme - Scheme item from the getSchemes response
 * @param {Object|null} statusResponse - payload=1 status response for the scheme
 * @param {Object} context - Shared derivation context
 * @param {{previous: SubsTerm|null, current: SubsTerm|null, next: SubsTerm|null}} context.terms - Term buckets
 * @param {Map<string, {member: Object, isYP: boolean}>} context.cachedById - scoutid to cached member and YP flag
 * @param {string} context.today - Today's date (yyyy-mm-dd)
 * @returns {Object} The scheme entry of a SectionSubsSummary
 */
function buildScheme(scheme, statusResponse, { terms, cachedById, today }) {
  const rows = statusResponse?.data?.members ?? [];

  const paymentsById = new Map();
  for (const row of rows) {
    for (const paymentId of paymentKeys(row)) {
      if (paymentsById.has(paymentId)) {
        continue;
      }
      const payment = row[paymentId];
      const date = payment?.date ?? null;
      paymentsById.set(paymentId, {
        paymentId,
        date,
        amount: Number(payment?.amount ?? 0),
        bucket: bucketPaymentDate(date, terms),
      });
    }
  }
  const payments = [...paymentsById.values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.paymentId.localeCompare(b.paymentId));

  const currentPaymentIds = payments.filter((p) => p.bucket === 'current').map((p) => p.paymentId);
  const duePaymentIds = payments
    .filter((p) => p.bucket === 'current' && p.date && p.date <= today)
    .map((p) => p.paymentId);

  const members = rows.map((row) => {
    const scoutId = String(row.scoutid);
    const memberPayments = {};
    for (const payment of payments) {
      const raw = row[payment.paymentId];
      if (!raw) {
        continue;
      }
      const latest = latestStatusEntry(raw);
      memberPayments[payment.paymentId] = {
        state: classifyPaymentState(raw),
        latestStatus: latest?.status ?? null,
        latestAt: latest?.statustimestamp ?? null,
        amount: Number(raw.amount ?? payment.amount),
        date: raw.date ?? payment.date,
        bucket: payment.bucket,
      };
    }
    return {
      scoutId,
      firstName: row.firstname ?? '',
      lastName: row.lastname ?? '',
      patrolId: row.patrolid !== undefined && row.patrolid !== null ? String(row.patrolid) : null,
      isYP: cachedById.get(scoutId)?.isYP ?? null,
      directDebit: row.directdebit ?? '',
      payments: memberPayments,
    };
  }).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const unpaidMembers = new Set();
  const pendingMembers = new Set();
  const paidCandidates = new Set();
  let unpaidAmount = 0;
  let pendingAmount = 0;

  for (const member of members) {
    let hasApplicableDue = false;
    let hasOutstanding = false;
    for (const paymentId of duePaymentIds) {
      const entry = member.payments[paymentId];
      if (!entry || entry.state === 'not-applicable') {
        continue;
      }
      hasApplicableDue = true;
      if (entry.state === 'required' || entry.state === 'not-started') {
        unpaidMembers.add(member.scoutId);
        unpaidAmount += entry.amount;
        hasOutstanding = true;
      } else if (entry.state === 'in-progress') {
        pendingMembers.add(member.scoutId);
        pendingAmount += entry.amount;
        hasOutstanding = true;
      }
    }
    if (hasApplicableDue && !hasOutstanding) {
      paidCandidates.add(member.scoutId);
    }
  }

  const coverage = {
    previous: payments.some((p) => p.bucket === 'previous'),
    current: payments.some((p) => p.bucket === 'current'),
    next: payments.some((p) => p.bucket === 'next'),
  };

  return {
    schemeId: String(scheme.schemeid),
    name: scheme.name ?? '',
    amountOverdue: Number(scheme.amount_overdue ?? 0),
    memberCount: members.length,
    ypCount: members.filter((member) => member.isYP === true).length,
    noDirectDebitCount: members.filter((member) => member.directDebit !== 'Active').length,
    payments,
    coverage,
    currentTerm: {
      paymentIds: currentPaymentIds,
      unpaid: { members: unpaidMembers.size, amount: round2(unpaidAmount) },
      pending: { members: pendingMembers.size, amount: round2(pendingAmount) },
      paidMembers: paidCandidates.size,
    },
    members,
  };
}

/**
 * Rounds a money total to two decimal places.
 *
 * @param {number} value - Amount
 * @returns {number} Rounded amount
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Builds the complete summary for one section.
 *
 * @param {Object} input - Everything the summary is derived from
 * @param {string|number} input.sectionId - Section id
 * @param {string} input.sectionName - Section display name
 * @param {Object|null} input.schemesResponse - Raw getSchemes response
 * @param {Object<string, Object>} input.statusResponses - Status response keyed by scheme id
 * @param {Array<Object>} input.members - Cached members (with per-section memberships)
 * @param {{previous: SubsTerm|null, current: SubsTerm|null, next: SubsTerm|null}} input.terms - Term buckets
 * @param {string} input.today - Today's date (yyyy-mm-dd)
 * @param {number} input.loadedAt - ms epoch of the newest response used
 * @param {boolean} input.fromCache - Whether any response came from the cache
 * @returns {Object} SectionSubsSummary
 */
export function buildSectionSubsSummary({
  sectionId,
  sectionName,
  schemesResponse,
  statusResponses = {},
  members = [],
  terms,
  today,
  loadedAt,
  fromCache = false,
}) {
  const allSchemes = schemesResponse?.items ?? [];
  const subsSchemes = allSchemes.filter((scheme) => Number(scheme.require_all) === 1);
  const otherSchemes = allSchemes
    .filter((scheme) => Number(scheme.require_all) !== 1)
    .map((scheme) => ({
      schemeId: String(scheme.schemeid),
      name: scheme.name ?? '',
      amountOverdue: Number(scheme.amount_overdue ?? 0),
    }));

  const cachedById = indexCachedMembers(members, sectionId);
  const ypById = new Map(
    [...cachedById.entries()].filter(([, entry]) => entry.isYP).map(([scoutId, entry]) => [scoutId, entry.member]),
  );
  const schemes = subsSchemes.map((scheme) =>
    buildScheme(scheme, statusResponses[String(scheme.schemeid)] ?? null, { terms, cachedById, today }));

  const ypInSubs = new Set();
  for (const scheme of schemes) {
    for (const member of scheme.members) {
      if (ypById.has(member.scoutId)) {
        ypInSubs.add(member.scoutId);
      }
    }
  }

  const ypNotInSubs = [...ypById.entries()]
    .filter(([scoutId]) => !ypInSubs.has(scoutId))
    .map(([scoutId, member]) => ({
      scoutId,
      firstName: member.firstname ?? '',
      lastName: member.lastname ?? '',
      patrolId: member.patrolid !== undefined && member.patrolid !== null ? String(member.patrolid) : null,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const unpaidScoutIds = new Set();
  let unpaidAmount = 0;
  for (const scheme of schemes) {
    unpaidAmount += scheme.currentTerm.unpaid.amount;
    for (const member of scheme.members) {
      for (const paymentId of scheme.currentTerm.paymentIds) {
        const entry = member.payments[paymentId];
        if (!entry || !entry.date || entry.date > today) {
          continue;
        }
        if (entry.state === 'required' || entry.state === 'not-started') {
          unpaidScoutIds.add(member.scoutId);
        }
      }
    }
  }

  return {
    sectionId: String(sectionId),
    sectionName,
    loadedAt,
    fromCache,
    terms: {
      previous: terms?.previous ?? null,
      current: terms?.current ?? null,
      next: terms?.next ?? null,
    },
    ypCount: ypById.size,
    subsCoverage: {
      previous: schemes.some((scheme) => scheme.coverage.previous),
      current: schemes.some((scheme) => scheme.coverage.current),
      next: schemes.some((scheme) => scheme.coverage.next),
    },
    schemes,
    otherSchemes,
    ypInSubsCount: ypInSubs.size,
    ypNotInSubs,
    unpaidTotal: { members: unpaidScoutIds.size, amount: round2(unpaidAmount) },
  };
}
