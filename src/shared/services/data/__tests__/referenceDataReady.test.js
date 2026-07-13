import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isReferenceDataReady,
  markReferenceDataReady,
  resetReferenceDataReady,
  subscribeReferenceDataReady,
} from '../referenceDataReady.js';

describe('referenceDataReady', () => {
  beforeEach(() => {
    resetReferenceDataReady();
  });

  it('starts not-ready and flips to ready when marked', () => {
    expect(isReferenceDataReady()).toBe(false);
    markReferenceDataReady();
    expect(isReferenceDataReady()).toBe(true);
  });

  it('reset returns to not-ready', () => {
    markReferenceDataReady();
    resetReferenceDataReady();
    expect(isReferenceDataReady()).toBe(false);
  });

  it('notifies subscribers on each mark, including a later re-mark', () => {
    const listener = vi.fn();
    subscribeReferenceDataReady(listener);
    markReferenceDataReady();
    markReferenceDataReady();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeReferenceDataReady(listener);
    unsubscribe();
    markReferenceDataReady();
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps notifying other subscribers when one throws', () => {
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    subscribeReferenceDataReady(bad);
    subscribeReferenceDataReady(good);
    expect(() => markReferenceDataReady()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
