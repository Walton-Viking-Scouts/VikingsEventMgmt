import { describe, it, expect } from 'vitest';
import { isSectionAllowed } from '../sectionFilterPredicate.js';

describe('isSectionAllowed', () => {
  it('returns true when sectionFilters is missing entirely', () => {
    expect(isSectionAllowed(123, null)).toBe(true);
    expect(isSectionAllowed(123, undefined)).toBe(true);
  });

  it('returns true when the section is explicitly enabled', () => {
    expect(isSectionAllowed(123, { 123: true })).toBe(true);
  });

  it('returns false when the section is explicitly disabled', () => {
    expect(isSectionAllowed(123, { 123: false })).toBe(false);
  });

  it('returns true when the section is missing from the filter map (default-show)', () => {
    // This is the contract that lets external-group attendees show up
    // immediately on Detailed/Register tabs, before the augmenting
    // useEffect in EventAttendance has populated the filter map with the
    // new sectionids from attendanceData.
    expect(isSectionAllowed(999, { 123: true, 456: true })).toBe(true);
  });

  it('treats null filter value as default-show (defensive)', () => {
    // Should never happen given the invariant, but if it did we'd prefer
    // showing data over silently hiding it.
    expect(isSectionAllowed(123, { 123: null })).toBe(true);
  });

  it('handles string and numeric sectionids uniformly', () => {
    // The filter map uses sectionid as the key — React/JS object keys are
    // strings, so a numeric and string sectionid for the same row collapse.
    expect(isSectionAllowed('123', { 123: false })).toBe(false);
    expect(isSectionAllowed(123, { '123': false })).toBe(false);
  });
});
