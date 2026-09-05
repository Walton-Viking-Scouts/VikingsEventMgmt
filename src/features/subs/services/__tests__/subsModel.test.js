import { describe, it, expect } from 'vitest';
import schemesFixture from '../../__fixtures__/getSchemes.json';
import statusFixture from '../../__fixtures__/paymentStatus.json';
import {
  buildSectionSubsSummary,
  bucketPaymentDate,
  classifyPaymentState,
  deriveTerms,
} from '../subsModel.js';

const TERMS = {
  previous: { termId: 'p', name: 'Summer 2026', startDate: '2026-04-01', endDate: '2026-08-31' },
  current: { termId: 'c', name: 'Autumn 2026', startDate: '2026-09-01', endDate: '2026-12-20' },
  next: { termId: 'n', name: 'Spring 2027', startDate: '2027-01-01', endDate: '2027-04-01' },
};

function summary(today, overrides = {}) {
  return buildSectionSubsSummary({
    sectionId: '49097',
    sectionName: 'Thursday Beavers',
    schemesResponse: { items: schemesFixture.items.filter((s) => s.schemeid !== '60604') },
    statusResponses: { 60603: statusFixture },
    members: [],
    terms: TERMS,
    today,
    loadedAt: 1757030400000,
    fromCache: false,
    ...overrides,
  });
}

describe('classifyPaymentState', () => {
  it('marks payments predating the member as not-applicable', () => {
    expect(classifyPaymentState({ active: false, status: [] })).toBe('not-applicable');
    expect(classifyPaymentState({ active: true, defaulton: false, status: [] })).toBe('not-applicable');
    expect(classifyPaymentState(null)).toBe('not-applicable');
  });

  it('uses the entry flagged latest, which is index 0 in the real data', () => {
    const payment = statusFixture.data.members[0]['975153'];
    expect(payment.status[0].latest).toBe('1');
    expect(classifyPaymentState(payment)).toBe('paid');
  });

  it('maps each status to its state', () => {
    const of = (status) => classifyPaymentState({ active: true, defaulton: true, status: [{ status, latest: '1' }] });
    expect(of('Received')).toBe('paid');
    expect(of('Paid manually')).toBe('paid');
    expect(of('Payment not required')).toBe('not-required');
    expect(of('Initiated')).toBe('in-progress');
    expect(of('Submitted')).toBe('in-progress');
    expect(of('Payment required')).toBe('required');
    expect(of('Something odd')).toBe('unknown');
    expect(classifyPaymentState({ active: true, defaulton: true, status: [] })).toBe('not-started');
  });
});

describe('bucketPaymentDate', () => {
  it('places dates in their term bucket and null outside them', () => {
    expect(bucketPaymentDate('2026-05-14', TERMS)).toBe('previous');
    expect(bucketPaymentDate('2026-09-15', TERMS)).toBe('current');
    expect(bucketPaymentDate('2027-01-15', TERMS)).toBe('next');
    expect(bucketPaymentDate('2025-04-01', TERMS)).toBeNull();
    expect(bucketPaymentDate(null, TERMS)).toBeNull();
  });
});

describe('deriveTerms', () => {
  const terms = [
    { termid: '1', name: 'Spring', startdate: '2026-01-05', enddate: '2026-03-28' },
    { termid: '2', name: 'Summer', startdate: '2026-04-01', enddate: '2026-07-20' },
    { termid: '3', name: 'Autumn', startdate: '2026-09-01', enddate: '2026-12-20' },
  ];

  it('picks the term containing today, with neighbours either side', () => {
    const result = deriveTerms(terms, '2026-05-01');
    expect(result.current.termId).toBe('2');
    expect(result.previous.termId).toBe('1');
    expect(result.next.termId).toBe('3');
  });

  it('falls back to the term that just ended during the holidays', () => {
    const result = deriveTerms(terms, '2026-08-10');
    expect(result.current.termId).toBe('2');
    expect(result.previous.termId).toBe('1');
    expect(result.next.termId).toBe('3');
  });

  it('has no current term when the last term ended long ago', () => {
    expect(deriveTerms(terms, '2028-09-01')).toEqual({ previous: null, current: null, next: null });
  });

  it('picks the previous term by latest end date, not by start date', () => {
    const overlapping = [
      { termid: 'long', name: 'Whole year', startdate: '2026-01-05', enddate: '2026-07-31' },
      { termid: 'short', name: 'Spring', startdate: '2026-01-10', enddate: '2026-03-28' },
      { termid: 'now', name: 'Autumn', startdate: '2026-09-01', enddate: '2026-12-20' },
    ];
    const result = deriveTerms(overlapping, '2026-10-01');
    expect(result.current.termId).toBe('now');
    expect(result.previous.termId).toBe('long');
  });

  it('returns all nulls with no usable terms', () => {
    expect(deriveTerms([], '2026-05-01')).toEqual({ previous: null, current: null, next: null });
    expect(deriveTerms(undefined, '2026-05-01').current).toBeNull();
  });
});

describe('next-term readiness and section rows', () => {
  it('reports next term scheduled, with ready and no-direct-debit members', () => {
    const result = summary('2026-09-20');
    const next = result.schemes[0].termStats.next;
    expect(next.scheduled).toBe(true);
    expect(next.paymentIds).toHaveLength(1);
    expect(next.readyMembers).toBe(6);
    expect(next.noDirectDebitMembers).toBe(2);
    expect(next.notApplicableMembers).toBe(0);
    expect(next.due).toEqual({ members: 8, amount: 208 });
    expect(next.paid).toEqual({ members: 0, amount: 0 });
    expect(next.overdue).toEqual({ members: 0, amount: 0 });
    expect(result.termTotals.next).toMatchObject({ scheduled: true, readyMembers: 6, noDirectDebitMembers: 2 });
  });

  it('marks a member the next payment does not apply to as not-applicable', () => {
    const patched = JSON.parse(JSON.stringify(statusFixture));
    patched.data.members[0]['1259481'].active = false;
    const result = summary('2026-09-20', { statusResponses: { 60603: patched } });
    const row = result.members.find((m) => m.scoutId === patched.data.members[0].scoutid);
    expect(row.nextSetUp).toBe('not-applicable');
    expect(result.schemes[0].termStats.next.notApplicableMembers).toBe(1);
  });

  it('reports not-scheduled for a scheme with no next-term payment', () => {
    const result = summary('2026-09-20', {
      terms: { ...TERMS, next: { termId: 'n', name: 'Far future', startDate: '2030-01-01', endDate: '2030-04-01' } },
    });
    expect(result.schemes[0].termStats.next).toMatchObject({
      scheduled: false, paymentIds: [], readyMembers: 0, due: { members: 0, amount: 0 },
    });
    expect(result.members.every((row) => row.nextSetUp === 'not-scheduled')).toBe(true);
    expect(result.termTotals.next.scheduled).toBe(false);
  });

  it('counts an early payment for next term as paid and set up', () => {
    const patched = JSON.parse(JSON.stringify(statusFixture));
    const early = patched.data.members.find((m) => m.directdebit === 'Inactive');
    early['1259481'].status = [{
      statusid: '1', status: 'Received', latest: '1', statustimestamp: '2026-09-19 10:00:00',
    }];
    const result = summary('2026-09-20', { statusResponses: { 60603: patched } });
    const next = result.schemes[0].termStats.next;
    expect(next.paid).toEqual({ members: 1, amount: 26 });
    expect(next.unpaid).toEqual({ members: 7, amount: 182 });
    expect(next.overdue).toEqual({ members: 0, amount: 0 });
    expect(next.readyMembers).toBe(7);
    expect(next.noDirectDebitMembers).toBe(1);
    const row = result.members.find((m) => m.scoutId === early.scoutid);
    expect(row.directDebit).toBe('Inactive');
    expect(row.nextSetUp).toBe('paid');
  });

  it('builds one row per member and scheme, sorted and bucketed', () => {
    const result = summary('2026-09-20');
    expect(result.members).toHaveLength(8);
    const names = result.members.map((row) => `${row.lastName} ${row.firstName}`);
    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const row = result.members[0];
    expect(row.schemeName).toBe('Leaders Subs');
    expect(row.buckets.current).toHaveLength(1);
    expect(row.buckets.current[0]).toMatchObject({ date: '2026-09-15', amount: 26, state: 'not-started' });
    expect(row.buckets.previous[0]).toMatchObject({ date: '2026-05-14', state: 'paid', latestStatus: 'Received' });
    expect(row.buckets.next[0]).toMatchObject({ date: '2027-01-15' });
  });

  it('gives a member in two schemes two rows but counts them once in the totals', () => {
    const second = JSON.parse(JSON.stringify(schemesFixture.items.find((s) => s.schemeid === '60604')));
    const result = buildSectionSubsSummary({
      sectionId: '49097',
      sectionName: 'Thursday Beavers',
      schemesResponse: { items: [schemesFixture.items[1], second] },
      statusResponses: { 60603: statusFixture, 60604: statusFixture },
      members: [],
      terms: TERMS,
      today: '2026-09-20',
      loadedAt: 1,
      fromCache: false,
    });
    expect(result.schemes).toHaveLength(2);
    expect(result.members).toHaveLength(16);
    const scoutId = statusFixture.data.members[0].scoutid;
    expect(result.members.filter((row) => row.scoutId === scoutId)).toHaveLength(2);
    expect(result.termTotals.current.unpaid).toEqual({ members: 8, amount: 416 });
    expect(result.termTotals.current.due).toEqual({ members: 8, amount: 416 });
    expect(result.termTotals.next.readyMembers).toBe(6);
  });
});

describe('buildSectionSubsSummary with the real capture', () => {
  it('reads 8 members and 6 payments of £26 on the known dates', () => {
    const scheme = summary('2026-09-20').schemes[0];
    expect(scheme.memberCount).toBe(8);
    expect(scheme.payments).toHaveLength(6);
    expect(scheme.payments.map((p) => p.date)).toEqual([
      '2025-04-01', '2025-10-04', '2026-01-16', '2026-05-14', '2026-09-15', '2027-01-15',
    ]);
    expect(scheme.payments.every((p) => p.amount === 26)).toBe(true);
  });

  it('marks payments predating a member as not-applicable and the rest paid through 2026-05-14', () => {
    const scheme = summary('2026-09-20').schemes[0];
    const early = scheme.payments[0].paymentId;
    const may = scheme.payments[3].paymentId;
    const states = scheme.members.map((m) => m.payments[early].state);
    expect(states).toContain('not-applicable');
    expect(states).toContain('paid');
    expect(scheme.members.every((m) => m.payments[may].state === 'paid')).toBe(true);
  });

  it('leaves the two later payments not-started', () => {
    const scheme = summary('2026-09-20').schemes[0];
    for (const index of [4, 5]) {
      const id = scheme.payments[index].paymentId;
      expect(scheme.members.every((m) => m.payments[id].state === 'not-started')).toBe(true);
    }
  });

  it('counts everyone unpaid for the due current-term payment', () => {
    const result = summary('2026-09-20');
    const stats = result.schemes[0].termStats;
    expect(stats.current.paymentIds).toHaveLength(1);
    expect(stats.current.unpaid).toEqual({ members: 8, amount: 208 });
    expect(stats.current.pending).toEqual({ members: 0, amount: 0 });
    expect(stats.current.overdue).toEqual({ members: 8, amount: 208 });
    expect(stats.current.due).toEqual({ members: 8, amount: 208 });
    expect(stats.previous.unpaid).toEqual({ members: 0, amount: 0 });
    expect(stats.previous.paid).toEqual({ members: 8, amount: 208 });
    expect(result.termTotals.current.unpaid).toEqual({ members: 8, amount: 208 });
    expect(result.termTotals.previous.unpaid).toEqual({ members: 0, amount: 0 });
  });

  it('counts the payment unpaid but not overdue before its date', () => {
    const result = summary('2026-09-10');
    const stats = result.schemes[0].termStats.current;
    expect(stats.unpaid).toEqual({ members: 8, amount: 208 });
    expect(stats.overdue).toEqual({ members: 0, amount: 0 });
    expect(result.termTotals.current.overdue).toEqual({ members: 0, amount: 0 });
  });

  it('ticks coverage per bucket from the payment dates', () => {
    const result = summary('2026-09-20');
    expect(result.schemes[0].coverage).toEqual({ previous: true, current: true, next: true });
    expect(result.subsCoverage).toEqual({ previous: true, current: true, next: true });
  });

  it('counts members without an active direct debit', () => {
    expect(summary('2026-09-20').schemes[0].noDirectDebitCount).toBe(2);
  });

  it('treats require_all 0 schemes as other schemes and never loads them', () => {
    const result = buildSectionSubsSummary({
      sectionId: '49097',
      sectionName: 'Thursday Beavers',
      schemesResponse: schemesFixture,
      statusResponses: { 60603: statusFixture },
      members: [],
      terms: TERMS,
      today: '2026-09-20',
      loadedAt: 1,
      fromCache: true,
    });
    expect(result.schemes.map((s) => s.name)).toEqual(['Leaders Subs', 'Beavers Subs']);
    expect(result.otherSchemes).toEqual([
      { schemeId: '31715', name: 'Camps and Activities', amountOverdue: 0 },
    ]);
    expect(result.fromCache).toBe(true);
  });

  it('derives YP in and not in subs from the cached members', () => {
    const [ypInSubs, adultInSubs] = statusFixture.data.members.map((m) => m.scoutid);
    const members = [
      { scoutid: ypInSubs, firstname: 'A', lastname: 'One', patrolid: '1', sections: [{ sectionid: 49097, person_type: 'Young People' }] },
      { scoutid: adultInSubs, firstname: 'E', lastname: 'Five', sections: [{ sectionid: 49097, person_type: 'Leaders' }] },
      { scoutid: '999', firstname: 'B', lastname: 'Two', patrolid: '2', sections: [{ sectionid: 49097, person_type: 'Young People' }] },
      { scoutid: '777', firstname: 'D', lastname: 'Four', sections: [{ sectionid: 12345, person_type: 'Young People' }] },
    ];
    const result = summary('2026-09-20', { members });
    expect(result.ypCount).toBe(2);
    expect(result.ypInSubsCount).toBe(1);
    expect(result.ypNotInSubs).toEqual([
      { scoutId: '999', firstName: 'B', lastName: 'Two', patrolId: '2' },
    ]);
    expect(result.schemes[0].ypCount).toBe(1);
  });

  it('marks isYP true, false and null from the cached memberships', () => {
    const [yp, adult, uncached] = statusFixture.data.members.map((m) => m.scoutid);
    const members = [
      { scoutid: yp, firstname: 'A', lastname: 'One', sections: [{ sectionid: 49097, person_type: 'Young People' }] },
      { scoutid: adult, firstname: 'E', lastname: 'Five', sections: [{ sectionid: 49097, person_type: 'Leaders' }] },
    ];
    const rows = summary('2026-09-20', { members }).schemes[0].members;
    const by = (id) => rows.find((m) => m.scoutId === id);
    expect(by(yp).isYP).toBe(true);
    expect(by(adult).isYP).toBe(false);
    expect(by(uncached).isYP).toBeNull();
  });

  it('treats Payment not required as settled, not unpaid', () => {
    const patched = JSON.parse(JSON.stringify(statusFixture));
    const paymentId = '1259480';
    for (const member of patched.data.members) {
      member[paymentId].status = [{ status: 'Payment not required', latest: '1', statustimestamp: '2026-09-16 09:00:00' }];
    }
    const result = summary('2026-09-20', { statusResponses: { 60603: patched } });
    const scheme = result.schemes[0];
    expect(scheme.members.every((m) => m.payments[paymentId].state === 'not-required')).toBe(true);
    expect(scheme.termStats.current.unpaid).toEqual({ members: 0, amount: 0 });
    expect(scheme.termStats.current.due).toEqual({ members: 8, amount: 208 });
  });
});
