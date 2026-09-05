/**
 * Hand-written SectionSubsSummary matching the data contract in
 * docs/features/subs-monitoring.md, used by the UI component and hook tests.
 *
 * @module subsTestFixtures
 */

/**
 * Builds a TermBucketStats with zeroed figures.
 *
 * @param {object} [fields] - Fields to merge over the zeroed defaults
 * @returns {object} A TermBucketStats
 */
export function termBucketStats(fields = {}) {
  return {
    paymentIds: [],
    scheduled: false,
    due: { members: 0, amount: 0 },
    paid: { members: 0, amount: 0 },
    unpaid: { members: 0, amount: 0 },
    overdue: { members: 0, amount: 0 },
    pending: { members: 0, amount: 0 },
    readyMembers: 0,
    noDirectDebitMembers: 0,
    notApplicableMembers: 0,
    ...fields,
  };
}

/**
 * Builds a section-level member row.
 *
 * @param {object} fields - Row fields to merge over the defaults
 * @returns {object} A SectionSubsSummary.members entry
 */
function memberRow(fields) {
  return {
    patrolId: '119078',
    directDebit: 'Active',
    buckets: { previous: [], current: [], next: [] },
    nextSetUp: 'ready',
    ...fields,
  };
}

/**
 * Builds a SectionSubsSummary with two subs schemes, one other scheme, four
 * five member rows (one per member and scheme), one unpaid previous payment,
 * one unpaid current payment and one of each nextSetUp state.
 *
 * @param {object} [overrides] - Fields to merge over the fixture
 * @returns {object} A SectionSubsSummary
 */
export function makeSummary(overrides = {}) {
  return {
    sectionId: '49097',
    sectionName: 'Thursday Beavers',
    loadedAt: 1757030400000,
    fromCache: false,
    terms: {
      previous: { termId: '1', name: 'Summer 2025', startDate: '2025-04-01', endDate: '2025-08-31' },
      current: { termId: '2', name: 'Autumn 2025', startDate: '2025-09-01', endDate: '2025-12-31' },
      next: { termId: '3', name: 'Spring 2026', startDate: '2026-01-01', endDate: '2026-03-31' },
    },
    ypCount: 24,
    subsCoverage: { previous: true, current: true, next: true },
    schemes: [
      {
        schemeId: '60604',
        name: 'Beavers Subs',
        amountOverdue: 12,
        memberCount: 3,
        ypCount: 2,
        noDirectDebitCount: 1,
        payments: [
          { paymentId: '1138365', date: '2025-05-15', amount: 24, isDue: true, bucket: 'previous' },
          { paymentId: '1259480', date: '2025-09-15', amount: 26, isDue: true, bucket: 'current' },
          { paymentId: '1259481', date: '2026-01-15', amount: 26, isDue: false, bucket: 'next' },
        ],
        coverage: { previous: true, current: true, next: true },
        termStats: {
          previous: termBucketStats({
            paymentIds: ['1138365'], scheduled: true,
            due: { members: 3, amount: 72 }, paid: { members: 2, amount: 48 },
            unpaid: { members: 1, amount: 24 }, overdue: { members: 1, amount: 24 },
          }),
          current: termBucketStats({
            paymentIds: ['1259480'], scheduled: true,
            due: { members: 3, amount: 78 }, paid: { members: 2, amount: 52 },
            unpaid: { members: 1, amount: 26 }, overdue: { members: 1, amount: 26 },
          }),
          next: termBucketStats({
            paymentIds: ['1259481'], scheduled: true,
            due: { members: 2, amount: 52 }, unpaid: { members: 2, amount: 52 },
            readyMembers: 1, noDirectDebitMembers: 1, notApplicableMembers: 1,
          }),
        },
        members: [],
      },
      {
        schemeId: '60605',
        name: 'Leaders Subs',
        amountOverdue: 0,
        memberCount: 1,
        ypCount: 0,
        noDirectDebitCount: 0,
        payments: [
          { paymentId: '1259999', date: '2025-09-20', amount: 10, isDue: true, bucket: 'current' },
        ],
        coverage: { previous: false, current: true, next: false },
        termStats: {
          previous: termBucketStats(),
          current: termBucketStats({
            paymentIds: ['1259999'], scheduled: true,
            due: { members: 1, amount: 10 }, paid: { members: 1, amount: 10 },
          }),
          next: termBucketStats(),
        },
        members: [],
      },
    ],
    otherSchemes: [{ schemeId: '31715', name: 'Camps and Activities', amountOverdue: 0 }],
    ypInSubsCount: 22,
    ypNotInSubs: [{ scoutId: '9', firstName: 'Eve', lastName: 'Evans', patrolId: '119078' }],
    termTotals: {
      previous: termBucketStats({
        paymentIds: ['1138365'], scheduled: true,
        due: { members: 3, amount: 72 }, paid: { members: 2, amount: 48 },
        unpaid: { members: 1, amount: 24 }, overdue: { members: 1, amount: 24 },
      }),
      current: termBucketStats({
        paymentIds: ['1259480', '1259999'], scheduled: true,
        due: { members: 4, amount: 88 }, paid: { members: 3, amount: 62 },
        unpaid: { members: 1, amount: 26 }, overdue: { members: 1, amount: 26 },
      }),
      next: termBucketStats({
        paymentIds: ['1259481'], scheduled: true,
        due: { members: 2, amount: 52 }, unpaid: { members: 2, amount: 52 },
        readyMembers: 1, noDirectDebitMembers: 1, notApplicableMembers: 1,
      }),
    },
    members: [
      memberRow({
        scoutId: '1', firstName: 'Ann', lastName: 'Adams', isYP: true,
        schemeId: '60604', schemeName: 'Beavers Subs',
        buckets: {
          previous: [{ paymentId: '1138365', date: '2025-05-15', amount: 24, isDue: true, state: 'paid', latestStatus: 'Received', latestAt: '2025-05-16 10:00:00' }],
          current: [
            { paymentId: '1259480', date: '2025-09-15', amount: 26, isDue: true, state: 'paid', latestStatus: 'Received', latestAt: '2025-09-16 10:00:00' },
            { paymentId: '1259482', date: '2026-09-15', amount: 26, isDue: false, state: 'required', latestStatus: 'Payment required', latestAt: '2026-09-01 10:00:00' },
          ],
          next: [
            { paymentId: '1259481', date: '2026-01-15', amount: 26, isDue: false, state: 'not-started', latestStatus: '', latestAt: null },
            { paymentId: '1259490', date: '2027-04-20', amount: 28, isDue: false, state: 'not-started', latestStatus: '', latestAt: null },
          ],
        },
        nextSetUp: 'ready',
      }),
      memberRow({
        scoutId: '2', firstName: 'Ben', lastName: 'Brown', isYP: true,
        directDebit: 'Inactive',
        schemeId: '60604', schemeName: 'Beavers Subs',
        buckets: {
          previous: [{ paymentId: '1138365', date: '2025-05-15', amount: 24, isDue: true, state: 'required', latestStatus: 'Payment required', latestAt: '2025-05-16 10:00:00' }],
          current: [
            { paymentId: '1259480', date: '2025-09-15', amount: 26, isDue: true, state: 'required', latestStatus: 'Payment required', latestAt: '2025-09-16 10:00:00' },
            { paymentId: '1259482', date: '2026-09-15', amount: 26, isDue: false, state: 'required', latestStatus: 'Payment required', latestAt: '2026-09-01 10:00:00' },
          ],
          next: [
            { paymentId: '1259481', date: '2026-01-15', amount: 26, isDue: false, state: 'in-progress', latestStatus: 'Initiated', latestAt: '2026-01-02 10:00:00' },
            { paymentId: '1259490', date: '2027-04-20', amount: 28, isDue: false, state: 'paid', latestStatus: 'Received', latestAt: '2027-01-05 10:00:00' },
          ],
        },
        nextSetUp: 'no-direct-debit',
      }),
      memberRow({
        scoutId: '3', firstName: 'Cara', lastName: 'Clark', isYP: null,
        patrolId: '119079',
        schemeId: '60604', schemeName: 'Beavers Subs',
        buckets: {
          previous: [{ paymentId: '1138365', date: '2025-05-15', amount: 24, isDue: true, state: 'paid', latestStatus: 'Paid', latestAt: '2025-05-16 10:00:00' }],
          current: [{ paymentId: '1259480', date: '2025-09-15', amount: 26, isDue: true, state: 'paid', latestStatus: 'Paid', latestAt: '2025-09-16 10:00:00' }],
          next: [],
        },
        nextSetUp: 'not-applicable',
      }),
      memberRow({
        scoutId: '4', firstName: 'Dan', lastName: 'Davies', isYP: false,
        patrolId: '-2',
        schemeId: '60605', schemeName: 'Leaders Subs',
        buckets: {
          previous: [],
          current: [{ paymentId: '1259999', date: '2025-09-20', amount: 10, isDue: true, state: 'paid', latestStatus: 'Received', latestAt: '2025-09-21 10:00:00' }],
          next: [],
        },
        nextSetUp: 'not-scheduled',
      }),
      memberRow({
        scoutId: '5', firstName: 'Fay', lastName: 'Foster', isYP: true,
        schemeId: '60604', schemeName: 'Beavers Subs',
        buckets: {
          previous: [{ paymentId: '1138365', date: '2025-05-15', amount: 24, isDue: true, state: 'paid', latestStatus: 'Received', latestAt: '2025-05-16 10:00:00' }],
          current: [{ paymentId: '1259480', date: '2025-09-15', amount: 26, isDue: true, state: 'paid', latestStatus: 'Received', latestAt: '2025-09-16 10:00:00' }],
          next: [{ paymentId: '1259481', date: '2026-01-15', amount: 26, isDue: false, state: 'paid', latestStatus: 'Received', latestAt: '2025-12-01 10:00:00' }],
        },
        nextSetUp: 'paid',
      }),
    ],
    ...overrides,
  };
}

/** Two viewable sections, as getSubsSections returns them. */
export const SECTIONS = [
  { sectionId: '49097', sectionName: 'Thursday Beavers', financePermission: 20, canView: true },
  { sectionId: '49098', sectionName: 'Friday Cubs', financePermission: 10, canView: true },
];

/** Sections including one the user has no finance access to. */
export const MIXED_SECTIONS = [
  { sectionId: '49097', sectionName: 'Thursday Beavers', financePermission: 20, canView: true },
  { sectionId: '49099', sectionName: 'Saturday Scouts', financePermission: 0, canView: false },
  { sectionId: '49098', sectionName: 'Friday Cubs', financePermission: 10, canView: true },
];

/** Three viewable sections, for ordering and continue-on-error tests. */
export const MIXED_VIEWABLE_SECTIONS = [
  { sectionId: '49097', sectionName: 'Adults', financePermission: 20, canView: true },
  { sectionId: '49098', sectionName: 'Friday Cubs', financePermission: 10, canView: true },
  { sectionId: '49100', sectionName: 'Monday Beavers', financePermission: 10, canView: true },
];
