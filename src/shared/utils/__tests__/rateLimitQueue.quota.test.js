import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimitQueue } from '../rateLimitQueue.js';

describe('RateLimitQueue.applyQuotaInfo', () => {
  let queue;

  beforeEach(() => {
    queue = new RateLimitQueue();
    localStorage.removeItem('osm_blocked');
  });

  it('keeps the default 20ms pacing while quota is healthy', () => {
    queue.applyQuotaInfo({ remaining: 500, limit: 1000 });
    expect(queue.interRequestDelay).toBe(20);
    expect(queue.rateLimitedUntil).toBeNull();
  });

  it('resets pacing back to 20ms when quota recovers', () => {
    queue.interRequestDelay = 4000;
    queue.applyQuotaInfo({ remaining: 20, limit: 1000 });
    expect(queue.interRequestDelay).toBe(20);
  });

  it('spreads remaining requests across the reset window when quota is low', () => {
    const resetInSixtySeconds = Math.floor(Date.now() / 1000) + 60;
    queue.applyQuotaInfo({ remaining: 12, limit: 1000, resetTime: resetInSixtySeconds });
    expect(queue.interRequestDelay).toBeGreaterThan(20);
    expect(queue.interRequestDelay).toBeLessThanOrEqual(5000);
    expect(queue.rateLimitedUntil).toBeNull();
  });

  it('caps the low-quota delay at 5 seconds', () => {
    const resetInTenMinutes = Math.floor(Date.now() / 1000) + 600;
    queue.applyQuotaInfo({ remaining: 6, limit: 1000, resetTime: resetInTenMinutes });
    expect(queue.interRequestDelay).toBe(5000);
  });

  it('pauses the queue until reset when quota is nearly exhausted', () => {
    const resetInThirtySeconds = Math.floor(Date.now() / 1000) + 30;
    queue.applyQuotaInfo({ remaining: 3, limit: 1000, resetTime: resetInThirtySeconds });
    expect(queue.rateLimitedUntil).toBeGreaterThanOrEqual(Date.now() + 5000);
  });

  it('ignores malformed quota payloads without changing pacing', () => {
    queue.applyQuotaInfo(null);
    queue.applyQuotaInfo({});
    queue.applyQuotaInfo({ remaining: NaN, limit: 1000 });
    queue.applyQuotaInfo({ remaining: 10, limit: 0 });
    expect(queue.interRequestDelay).toBe(20);
    expect(queue.rateLimitedUntil).toBeNull();
  });
});

describe('RateLimitQueue blocked guard', () => {
  it('rejects enqueued requests immediately when OSM access is blocked', async () => {
    localStorage.setItem('osm_blocked', 'true');
    const queue = new RateLimitQueue();
    await expect(queue.enqueue(async () => 'result')).rejects.toThrow('blocked');
    localStorage.removeItem('osm_blocked');
  });
});
