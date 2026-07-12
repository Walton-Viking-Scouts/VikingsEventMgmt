import { describe, expect, it } from 'vitest';

import {
  bucketSessionsByWeek,
  expandWeeklySlot,
  generateSessionsFromProgramme,
  groupByHorizon,
  groupSessionsByDay,
  startOfIsoWeek,
} from '../rotaDates.js';

const CUBS = { sid: '49097', sname: 'Cubs', act: 'Kayaking', st: '18:15', en: '19:30' };
const RANGE = { start: '2026-06-01', end: '2026-08-31' };

describe('generateSessionsFromProgramme', () => {
  it('creates one session per meeting inside the range, programme times winning', () => {
    const meetings = [
      { date: '2026-06-02', startTime: '18:00', endTime: '19:15', title: 'Water night 1' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Water night 2' },
      { date: '2026-05-26', startTime: '18:00', endTime: '19:15', title: 'Before range' },
      { date: '2026-09-01', startTime: '18:00', endTime: '19:15', title: 'After range' },
    ];

    const sessions = generateSessionsFromProgramme(meetings, CUBS, RANGE);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      date: '2026-06-02',
      startTime: '18:00',
      endTime: '19:15',
      title: 'Water night 1',
    });
    expect(sessions[1]).toMatchObject({ date: '2026-06-09', startTime: '18:15', endTime: '19:30' });
  });

  it('derives activity from the meeting title, falling back to the section default', () => {
    const meetings = [
      { date: '2026-06-02', startTime: null, endTime: null, title: 'Cubs Powerboats' },
      { date: '2026-06-09', startTime: null, endTime: null, title: 'Water fun' },
    ];
    const sessions = generateSessionsFromProgramme(meetings, CUBS, RANGE);
    expect(sessions[0].activity).toBe('Powerboats');
    expect(sessions[1].activity).toBe('Kayaking'); // no title match → section default
  });

  it('collapses duplicate meeting dates to the first meeting', () => {
    const meetings = [
      { date: '2026-06-02', startTime: '18:00', endTime: '19:00', title: 'First' },
      { date: '2026-06-02', startTime: '20:00', endTime: '21:00', title: 'Second' },
    ];
    const sessions = generateSessionsFromProgramme(meetings, CUBS, RANGE);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('First');
  });

  it('handles an empty programme', () => {
    expect(generateSessionsFromProgramme([], CUBS, RANGE)).toEqual([]);
    expect(generateSessionsFromProgramme(undefined, CUBS, RANGE)).toEqual([]);
  });
});

describe('expandWeeklySlot', () => {
  it('produces the slot weekday for every week in the range', () => {
    const slot = { weekday: 2, ...CUBS };
    const sessions = expandWeeklySlot(slot, { start: '2026-06-01', end: '2026-06-30' });
    expect(sessions.map((s) => s.date)).toEqual([
      '2026-06-02',
      '2026-06-09',
      '2026-06-16',
      '2026-06-23',
      '2026-06-30',
    ]);
    expect(new Set(sessions.map((s) => new Date(s.date).getDay()))).toEqual(new Set([2]));
  });

  it('starts on the range start when it falls on the slot weekday', () => {
    const slot = { weekday: 1, ...CUBS };
    const sessions = expandWeeklySlot(slot, { start: '2026-06-01', end: '2026-06-15' });
    expect(sessions.map((s) => s.date)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15']);
  });

  it('spans the October DST change without skipping or duplicating weeks', () => {
    const slot = { weekday: 7, ...CUBS };
    const sessions = expandWeeklySlot(slot, { start: '2026-10-19', end: '2026-11-02' });
    expect(sessions.map((s) => s.date)).toEqual(['2026-10-25', '2026-11-01']);
  });
});

describe('bucketSessionsByWeek', () => {
  it('groups by Monday-start weeks in ascending order', () => {
    const sessions = [
      { date: '2026-06-12' },
      { date: '2026-06-02' },
      { date: '2026-06-05' },
    ];
    const weeks = bucketSessionsByWeek(sessions);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-06-01', '2026-06-08']);
    expect(weeks[0].sessions.map((s) => s.date)).toEqual(['2026-06-02', '2026-06-05']);
  });
});

describe('groupSessionsByDay', () => {
  it('returns an empty array for no sessions', () => {
    expect(groupSessionsByDay([])).toEqual([]);
    expect(groupSessionsByDay(undefined)).toEqual([]);
  });

  it('groups multiple sections on the same day, keeping incoming order', () => {
    const sessions = [
      { date: '2026-06-02', sectionName: 'Cubs' },
      { date: '2026-06-02', sectionName: 'Beavers' },
    ];
    const days = groupSessionsByDay(sessions);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-06-02');
    expect(days[0].sessions.map((s) => s.sectionName)).toEqual(['Cubs', 'Beavers']);
  });

  it('sorts multiple days ascending', () => {
    const sessions = [
      { date: '2026-06-05', sectionName: 'Scouts' },
      { date: '2026-06-02', sectionName: 'Cubs' },
    ];
    const days = groupSessionsByDay(sessions);
    expect(days.map((d) => d.date)).toEqual(['2026-06-02', '2026-06-05']);
  });
});

describe('groupByHorizon', () => {
  it('buckets by this week, next week, later, and past', () => {
    const sessions = [
      { date: '2026-07-08' },
      { date: '2026-07-10' },
      { date: '2026-07-14' },
      { date: '2026-07-21' },
      { date: '2026-07-06' },
    ];
    const buckets = groupByHorizon(sessions, '2026-07-10');
    expect(buckets.past.map((s) => s.date)).toEqual(['2026-07-06', '2026-07-08']);
    expect(buckets.thisWeek.map((s) => s.date)).toEqual(['2026-07-10']);
    expect(buckets.nextWeek.map((s) => s.date)).toEqual(['2026-07-14']);
    expect(buckets.later.map((s) => s.date)).toEqual(['2026-07-21']);
  });
});

describe('startOfIsoWeek', () => {
  it('returns the Monday of the containing week', () => {
    expect(startOfIsoWeek('2026-07-10')).toBe('2026-07-06');
    expect(startOfIsoWeek('2026-07-06')).toBe('2026-07-06');
    expect(startOfIsoWeek('2026-07-12')).toBe('2026-07-06');
  });
});
