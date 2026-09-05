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

const SET_UP_PRECEDENCE = ['not-scheduled', 'not-applicable', 'no-direct-debit', 'ready', 'paid'];

/**
 * Whether a member's subs for a bucket will be (or have been) collected.
 * Parents can pay a term early, so `paid` outranks the mandate check.
 *
 * @param {Array<Object>} entries - The member's payment entries in the bucket
 * @param {string} directDebit - The member's direct debit state
 * @param {boolean} scheduled - Whether the scheme has any payment in the bucket
 * @returns {'paid'|'ready'|'no-direct-debit'|'not-applicable'|'not-scheduled'} The set-up state
 */
function setUpState(entries, directDebit, scheduled) {
  if (!scheduled) {
    return 'not-scheduled';
  }
  const applicable = entries.filter((entry) => entry.state !== 'not-applicable');
  if (applicable.length === 0) {
    return 'not-applicable';
  }
  if (applicable.some((entry) => entry.state === 'paid')) {
    return 'paid';
  }
  return directDebit === 'Active' ? 'ready' : 'no-direct-debit';
}

/**
 * The member rows of one scheme reduced to a bucket: each member's payment
 * entries in that bucket plus their set-up state.
 *
 * @param {Array<Object>} members - The scheme's member rows
 * @param {string[]} paymentIds - Payment ids in the bucket
 * @returns {Array<{scoutId: string, setUp: string, entries: Array<Object>}>} Bucket rows
 */
function bucketRows(members, paymentIds) {
  const scheduled = paymentIds.length > 0;
  return members.map((member) => {
    const entries = paymentIds.map((paymentId) => member.payments[paymentId]).filter(Boolean);
    return {
      scoutId: member.scoutId,
      setUp: setUpState(entries, member.directDebit, scheduled),
      entries,
    };
  });
}

/**
 * TermBucketStats for a set of bucket rows: members counted once each,
 * amounts summed over their payments.
 *
 * @param {Array<{scoutId: string, setUp: string, entries: Array<Object>}>} rows - Bucket rows
 * @param {string[]} paymentIds - Payment ids in the bucket
 * @param {string} today - Today's date (yyyy-mm-dd)
 * @returns {Object} TermBucketStats
 */
function bucketStats(rows, paymentIds, today) {
  const groups = ['due', 'paid', 'unpaid', 'overdue', 'pending'];
  const members = Object.fromEntries(groups.map((group) => [group, new Set()]));
  const amounts = Object.fromEntries(groups.map((group) => [group, 0]));
  const setUp = { paid: 0, ready: 0, 'no-direct-debit': 0, 'not-applicable': 0, 'not-scheduled': 0 };

  const record = (group, scoutId, amount) => {
    members[group].add(scoutId);
    amounts[group] += amount;
  };

  for (const row of rows) {
    setUp[row.setUp] += 1;
    for (const entry of row.entries) {
      if (entry.state === 'not-applicable') {
        continue;
      }
      record('due', row.scoutId, entry.amount);
      if (entry.state === 'paid') {
        record('paid', row.scoutId, entry.amount);
      } else if (entry.state === 'required' || entry.state === 'not-started') {
        record('unpaid', row.scoutId, entry.amount);
        if (entry.date && entry.date <= today) {
          record('overdue', row.scoutId, entry.amount);
        }
      } else if (entry.state === 'in-progress') {
        record('pending', row.scoutId, entry.amount);
      }
    }
  }

  const stats = {
    paymentIds,
    scheduled: paymentIds.length > 0,
  };
  for (const group of groups) {
    stats[group] = { members: members[group].size, amount: round2(amounts[group]) };
  }
  stats.readyMembers = setUp.ready + setUp.paid;
  stats.noDirectDebitMembers = setUp['no-direct-debit'];
  stats.notApplicableMembers = setUp['not-applicable'];
  return stats;
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

  const bucketPaymentIds = {
    previous: payments.filter((p) => p.bucket === 'previous').map((p) => p.paymentId),
    current: payments.filter((p) => p.bucket === 'current').map((p) => p.paymentId),
    next: payments.filter((p) => p.bucket === 'next').map((p) => p.paymentId),
  };

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

  const termStats = Object.fromEntries(['previous', 'current', 'next'].map((bucket) => [
    bucket,
    bucketStats(bucketRows(members, bucketPaymentIds[bucket]), bucketPaymentIds[bucket], today),
  ]));

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
    termStats,
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

  const sectionMembers = [];
  for (const scheme of schemes) {
    for (const member of scheme.members) {
      const buckets = { previous: [], current: [], next: [] };
      for (const bucket of ['previous', 'current', 'next']) {
        buckets[bucket] = scheme.termStats[bucket].paymentIds
          .map((paymentId) => {
            const entry = member.payments[paymentId];
            return entry
              ? {
                paymentId,
                date: entry.date,
                amount: entry.amount,
                state: entry.state,
                latestStatus: entry.latestStatus,
                latestAt: entry.latestAt,
              }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      }
      sectionMembers.push({
        scoutId: member.scoutId,
        firstName: member.firstName,
        lastName: member.lastName,
        patrolId: member.patrolId,
        isYP: member.isYP,
        directDebit: member.directDebit,
        schemeId: scheme.schemeId,
        schemeName: scheme.name,
        buckets,
        nextSetUp: setUpState(
          buckets.next,
          member.directDebit,
          scheme.termStats.next.scheduled,
        ),
      });
    }
  }
  sectionMembers.sort((a, b) =>
    a.lastName.localeCompare(b.lastName)
    || a.firstName.localeCompare(b.firstName)
    || a.schemeName.localeCompare(b.schemeName));

  const termTotals = Object.fromEntries(['previous', 'current', 'next'].map((bucket) => {
    const paymentIds = schemes.flatMap((scheme) => scheme.termStats[bucket].paymentIds);
    const byMember = new Map();
    for (const scheme of schemes) {
      for (const row of bucketRows(scheme.members, scheme.termStats[bucket].paymentIds)) {
        const existing = byMember.get(row.scoutId);
        if (!existing) {
          byMember.set(row.scoutId, { ...row, entries: [...row.entries] });
          continue;
        }
        existing.entries.push(...row.entries);
        if (SET_UP_PRECEDENCE.indexOf(row.setUp) > SET_UP_PRECEDENCE.indexOf(existing.setUp)) {
          existing.setUp = row.setUp;
        }
      }
    }
    return [bucket, bucketStats([...byMember.values()], paymentIds, today)];
  }));

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
    termTotals,
    members: sectionMembers,
  };
}
