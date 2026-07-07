import { describe, it, expect } from 'vitest';
import { getAttendanceStatus, checkAttendanceMatch, incrementAttendanceCount } from '../attendanceHelpers.js';

describe('getAttendanceStatus', () => {
  it.each([
    ['Yes', 'yes'],
    [1, 'yes'],
    ['No', 'no'],
    [0, 'no'],
    ['Invited', 'invited'],
    [2, 'invited'],
    ['Not Invited', 'notInvited'],
    [3, 'notInvited'],
  ])('maps %j to %s', (attending, expected) => {
    expect(getAttendanceStatus(attending)).toBe(expected);
  });

  it.each([
    [''],
    [null],
    [undefined],
    ['Maybe'],
  ])('maps unknown/blank value %j to notInvited (OSM returns "" for never-invited members)', (attending) => {
    expect(getAttendanceStatus(attending)).toBe('notInvited');
  });
});

describe('checkAttendanceMatch', () => {
  const onlyNotInvited = { yes: false, no: false, invited: false, notInvited: true };
  const gateDefault = { yes: true, no: false, invited: true, notInvited: false };

  it('matches blank RSVP under the Not Invited filter', () => {
    expect(checkAttendanceMatch('', onlyNotInvited)).toBe(true);
  });

  it('does not match blank RSVP when Not Invited is off', () => {
    expect(checkAttendanceMatch('', gateDefault)).toBe(false);
  });

  it('matches the gate defaults for Yes and Invited', () => {
    expect(checkAttendanceMatch('Yes', gateDefault)).toBe(true);
    expect(checkAttendanceMatch('Invited', gateDefault)).toBe(true);
    expect(checkAttendanceMatch('No', gateDefault)).toBe(false);
  });
});

describe('incrementAttendanceCount', () => {
  it('counts a blank RSVP as notInvited', () => {
    const member = { yes: 0, no: 0, invited: 0, notInvited: 0 };
    incrementAttendanceCount(member, '');
    expect(member.notInvited).toBe(1);
    expect(member.yes + member.no + member.invited).toBe(0);
  });
});
