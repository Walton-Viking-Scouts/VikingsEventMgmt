/**
 * Hand-written SectionSubsSummary matching the data contract in
 * docs/features/subs-monitoring.md, used by the UI component and hook tests.
 *
 * @module subsTestFixtures
 */

/**
 * Builds a SectionSubsSummary with two subs schemes, one other scheme, four
 * members and one unpaid member.
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
      next: null,
    },
    ypCount: 24,
    subsCoverage: { previous: true, current: true, next: false },
    schemes: [
      {
        schemeId: '60604',
        name: 'Beavers Subs',
        amountOverdue: 12,
        memberCount: 4,
        ypCount: 2,
        noDirectDebitCount: 1,
        payments: [
          { paymentId: '1259480', date: '2025-09-15', amount: 26, bucket: 'current' },
        ],
        coverage: { previous: true, current: true, next: false },
        currentTerm: {
          paymentIds: ['1259480'],
          unpaid: { members: 1, amount: 26 },
          pending: { members: 0, amount: 0 },
          paidMembers: 2,
        },
        members: [
          {
            scoutId: '1', firstName: 'Ann', lastName: 'Adams', patrolId: '119078',
            isYP: true, directDebit: 'Active',
            payments: {
              '1259480': { state: 'paid', latestStatus: 'Received', latestAt: '2025-09-16 10:00:00', amount: 26, date: '2025-09-15', bucket: 'current' },
            },
          },
          {
            scoutId: '2', firstName: 'Ben', lastName: 'Brown', patrolId: '119078',
            isYP: true, directDebit: 'Inactive',
            payments: {
              '1259480': { state: 'required', latestStatus: 'Payment required', latestAt: '2025-09-16 10:00:00', amount: 26, date: '2025-09-15', bucket: 'current' },
            },
          },
          {
            scoutId: '3', firstName: 'Cara', lastName: 'Clark', patrolId: '119079',
            isYP: null, directDebit: 'Active',
            payments: {
              '1259480': { state: 'paid', latestStatus: 'Paid', latestAt: '2025-09-16 10:00:00', amount: 26, date: '2025-09-15', bucket: 'current' },
            },
          },
          {
            scoutId: '5', firstName: 'Fay', lastName: 'Foster', patrolId: '-2',
            isYP: false, directDebit: 'Active',
            payments: {
              '1259480': { state: 'paid', latestStatus: 'Paid', latestAt: '2025-09-16 10:00:00', amount: 26, date: '2025-09-15', bucket: 'current' },
            },
          },
        ],
      },
      {
        schemeId: '60605',
        name: 'Leaders Subs',
        amountOverdue: 0,
        memberCount: 1,
        ypCount: 0,
        noDirectDebitCount: 0,
        payments: [
          { paymentId: '1259999', date: '2025-09-20', amount: 10, bucket: 'current' },
        ],
        coverage: { previous: false, current: true, next: false },
        currentTerm: {
          paymentIds: ['1259999'],
          unpaid: { members: 0, amount: 0 },
          pending: { members: 0, amount: 0 },
          paidMembers: 1,
        },
        members: [
          {
            scoutId: '4', firstName: 'Dan', lastName: 'Davies', patrolId: '-2',
            isYP: false, directDebit: 'Active',
            payments: {
              '1259999': { state: 'paid', latestStatus: 'Received', latestAt: '2025-09-21 10:00:00', amount: 10, date: '2025-09-20', bucket: 'current' },
            },
          },
        ],
      },
    ],
    otherSchemes: [{ schemeId: '31715', name: 'Camps and Activities', amountOverdue: 0 }],
    ypInSubsCount: 22,
    ypNotInSubs: [{ scoutId: '9', firstName: 'Eve', lastName: 'Evans', patrolId: '119078' }],
    unpaidTotal: { members: 1, amount: 26 },
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
