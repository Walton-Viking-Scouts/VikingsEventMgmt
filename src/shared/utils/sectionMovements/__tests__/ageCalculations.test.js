import { describe, it, expect } from 'vitest';
import { 
  calculateAgeAtDate, 
  willMemberMoveUp,
} from '../ageCalculations.js';

describe('calculateAgeAtDate', () => {
  it('calculates age correctly for basic cases', () => {
    const age = calculateAgeAtDate('2016-01-01', '2024-01-01');
    expect(age).toBe(8);
  });

  it('handles fractional ages correctly', () => {
    const age = calculateAgeAtDate('2014-01-01', '2024-07-01');
    expect(age).toBeCloseTo(10.5, 1);
  });

  it('handles birthdays on term start date', () => {
    const age = calculateAgeAtDate('2016-01-15', '2024-01-15');
    expect(age).toBe(8);
  });

  it('handles leap year edge cases', () => {
    const age = calculateAgeAtDate('2016-02-29', '2024-02-29');
    expect(age).toBe(8);
  });

  it('returns 0 for future birthdates', () => {
    const age = calculateAgeAtDate('2025-01-01', '2024-01-01');
    expect(age).toBe(0);
  });

  it('throws error for missing parameters', () => {
    expect(() => calculateAgeAtDate(null, '2024-01-01')).toThrow();
    expect(() => calculateAgeAtDate('2016-01-01', null)).toThrow();
  });
});

describe('willMemberMoveUp', () => {
  const termStart = '2024-01-01';

  it('identifies Beavers moving to Cubs correctly', () => {
    const member = {
      date_of_birth: '2015-10-01',
      sectionname: 'Wednesday Beavers',
    };
    
    expect(willMemberMoveUp(member, termStart)).toBe(true);
  });

  it('identifies Cubs moving to Scouts correctly', () => {
    const member = {
      date_of_birth: '2013-06-01', 
      sectionname: 'Monday Cubs',
    };
    
    expect(willMemberMoveUp(member, termStart)).toBe(true);
  });

  it('does not move members who are too young', () => {
    const member = {
      date_of_birth: '2017-06-01',
      sectionname: 'Wednesday Beavers',
    };
    
    expect(willMemberMoveUp(member, termStart)).toBe(false);
  });

  it('handles missing birth date', () => {
    const member = {
      sectionname: 'Wednesday Beavers',
    };
    
    expect(willMemberMoveUp(member, termStart)).toBe(false);
  });

  it('handles unknown section types', () => {
    const member = {
      date_of_birth: '2016-01-01',
      sectionname: 'Unknown Section',
    };
    
    expect(willMemberMoveUp(member, termStart)).toBe(false);
  });
});