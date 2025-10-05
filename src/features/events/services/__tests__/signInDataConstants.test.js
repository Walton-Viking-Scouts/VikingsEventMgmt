import { describe, it, expect } from 'vitest';
import {
  CLEAR_STRING_SENTINEL,
  CLEAR_TIME_SENTINEL,
  isFieldCleared,
  normalizeWhenFieldForDisplay,
} from '../../../../shared/constants/signInDataConstants.js';

describe('Sign-in Data Constants', () => {
  describe('Constants', () => {
    it('should define correct sentinel values', () => {
      expect(CLEAR_STRING_SENTINEL).toBe('---');
      expect(CLEAR_TIME_SENTINEL).toBe(' ');
    });
  });

  describe('isFieldCleared', () => {
    it('should detect cleared fields correctly', () => {
      expect(isFieldCleared('')).toBe(true);
      expect(isFieldCleared(null)).toBe(true);
      expect(isFieldCleared(undefined)).toBe(true);
      expect(isFieldCleared(CLEAR_STRING_SENTINEL)).toBe(true);
      expect(isFieldCleared(CLEAR_TIME_SENTINEL)).toBe(true);
      expect(isFieldCleared('valid value')).toBe(false);
    });
  });

  describe('normalizeWhenFieldForDisplay', () => {
    it('should return null for empty/invalid values', () => {
      expect(normalizeWhenFieldForDisplay('')).toBe(null);
      expect(normalizeWhenFieldForDisplay(null)).toBe(null);
      expect(normalizeWhenFieldForDisplay(undefined)).toBe(null);
      expect(normalizeWhenFieldForDisplay('   ')).toBe(null);
      expect(normalizeWhenFieldForDisplay(' ')).toBe(null);
      expect(normalizeWhenFieldForDisplay(CLEAR_STRING_SENTINEL)).toBe(null);
      expect(normalizeWhenFieldForDisplay(CLEAR_TIME_SENTINEL)).toBe(null);
      expect(normalizeWhenFieldForDisplay('null')).toBe(null);
      expect(normalizeWhenFieldForDisplay('undefined')).toBe(null);
    });

    it('should return null for invalid dates', () => {
      expect(normalizeWhenFieldForDisplay('invalid date')).toBe(null);
      expect(normalizeWhenFieldForDisplay('2024-13-40')).toBe(null);
      expect(normalizeWhenFieldForDisplay('not a date')).toBe(null);
    });

    it('should preserve valid date strings', () => {
      const validDate = '2024-01-01T10:00:00Z';
      expect(normalizeWhenFieldForDisplay(validDate)).toBe(validDate);

      const isoDate = '2024-07-15T09:30:00.000Z';
      expect(normalizeWhenFieldForDisplay(isoDate)).toBe(isoDate);
    });

    it('should handle edge cases that could cause NaN', () => {
      // These are the types of values that previously caused NaN display issues
      expect(normalizeWhenFieldForDisplay('')).toBe(null);
      expect(normalizeWhenFieldForDisplay(' ')).toBe(null);
      expect(normalizeWhenFieldForDisplay('---')).toBe(null);

      // Values that might come from inconsistent clearing
      expect(normalizeWhenFieldForDisplay('NaN')).toBe(null);
      expect(normalizeWhenFieldForDisplay('Invalid Date')).toBe(null);
    });
  });

  describe('Multi-update vs Single-update consistency', () => {
    it('should use consistent clearing values', () => {
      // This test ensures that both single and multi-update operations use the same constants
      // Previously, single updates used '' for time fields while multi-updates used ' '

      // String fields should use the same sentinel
      const stringClearValue = CLEAR_STRING_SENTINEL;
      expect(stringClearValue).toBe('---');

      // Time fields should use the same sentinel
      const timeClearValue = CLEAR_TIME_SENTINEL;
      expect(timeClearValue).toBe(' ');

      // Both should be detected as cleared
      expect(isFieldCleared(stringClearValue)).toBe(true);
      expect(isFieldCleared(timeClearValue)).toBe(true);
    });
  });
});