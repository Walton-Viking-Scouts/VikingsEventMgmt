/**
 * Shared term-bucket labelling and row helpers for the subs tables.
 *
 * @module termLabels
 */

const UNPAID_STATES = new Set(['required', 'not-started']);

const STATE_CLASSES = {
  'paid': 'bg-green-100 text-green-800 border-green-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'required': 'bg-amber-100 text-amber-800 border-amber-200',
  'not-started': 'bg-amber-100 text-amber-800 border-amber-200',
  'not-required': 'bg-slate-100 text-slate-600 border-slate-200',
};

const NOT_APPLICABLE_BADGE = { label: 'N/A', className: 'bg-slate-100 text-slate-500 border-slate-200' };

/** Display labels for the three term buckets. */
export const BUCKET_LABELS = { previous: 'Previous', current: 'Current', next: 'Next' };

/** The term buckets in display order. */
export const BUCKETS = ['previous', 'current', 'next'];

/**
 * Whether a member row has an overdue payment in the previous or current term.
 * A payment that is merely scheduled does not flag the row.
 *
 * @param {object} row - A SectionSubsSummary.members entry
 * @returns {boolean} True when any previous or current payment is overdue
 */
export function hasOverdue(row) {
  return ['previous', 'current'].some((bucket) =>
    (row?.buckets?.[bucket] ?? []).some(isOverdue),
  );
}

/**
 * Header text for a term bucket, naming the term when it is known.
 *
 * @param {string} bucket - Term bucket key
 * @param {object} [terms] - A SectionSubsSummary.terms object
 * @returns {string} Header text, e.g. "Previous · Summer 2026"
 */
export function bucketHeader(bucket, terms) {
  const name = terms?.[bucket]?.name;
  return name ? `${BUCKET_LABELS[bucket]} · ${name}` : BUCKET_LABELS[bucket];
}

/**
 * Whether a payment entry is unpaid and already due, i.e. genuinely overdue
 * rather than merely scheduled.
 *
 * @param {object} entry - A payment entry from members[].buckets.*
 * @returns {boolean} True when the payment is due and unpaid
 */
export function isOverdue(entry) {
  return Boolean(entry?.isDue) && UNPAID_STATES.has(entry?.state);
}

/**
 * The badge for one member's payment, showing OSM's own status text so
 * leaders read the wording they already know, coloured by our state category.
 *
 * @param {object} entry - A payment entry from members[].buckets.*
 * @returns {{label: string, className: string}|null} Badge, or null when OSM has no status yet
 */
export function paymentBadge(entry) {
  if (entry?.state === 'not-applicable') {
    return NOT_APPLICABLE_BADGE;
  }

  const label = entry?.latestStatus;
  if (!label) {
    return null;
  }

  return {
    label,
    className: STATE_CLASSES[entry?.state] ?? 'bg-neutral-100 text-neutral-700 border-neutral-300',
  };
}

/**
 * Whether a subs scheme is a leaders' scheme (the discounted scheme for
 * leaders' children), identified by "leader" in its name.
 *
 * @param {{name: string}} scheme - A SectionSubsSummary.schemes entry
 * @returns {boolean} True for a leaders' scheme
 */
export function isLeadersScheme(scheme) {
  return /leader/i.test(scheme?.name ?? '');
}

/**
 * Young-people counts split between leaders' schemes and the rest.
 *
 * @param {Array<object>} [schemes] - SectionSubsSummary.schemes
 * @returns {{leaders: number|null, section: number}} Counts, leaders null when there is no leaders' scheme
 */
export function ypBySchemeKind(schemes) {
  const all = schemes ?? [];
  const leaderSchemes = all.filter(isLeadersScheme);
  return {
    leaders: leaderSchemes.length === 0
      ? null
      : leaderSchemes.reduce((total, scheme) => total + (Number(scheme.ypCount) || 0), 0),
    section: all
      .filter((scheme) => !isLeadersScheme(scheme))
      .reduce((total, scheme) => total + (Number(scheme.ypCount) || 0), 0),
  };
}
