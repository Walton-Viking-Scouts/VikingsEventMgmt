/**
 * Shared term-bucket labelling and row helpers for the subs tables.
 *
 * @module termLabels
 */

const UNPAID_STATES = new Set(['required', 'not-started']);

/** Display labels for the three term buckets. */
export const BUCKET_LABELS = { previous: 'Previous', current: 'Current', next: 'Next' };

/** The term buckets in display order. */
export const BUCKETS = ['previous', 'current', 'next'];

/**
 * Whether a member row has an unpaid payment in the previous or current term.
 *
 * @param {object} row - A SectionSubsSummary.members entry
 * @returns {boolean} True when any previous or current payment is unpaid
 */
export function hasUnpaid(row) {
  return ['previous', 'current'].some((bucket) =>
    (row?.buckets?.[bucket] ?? []).some((payment) => UNPAID_STATES.has(payment.state)),
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
