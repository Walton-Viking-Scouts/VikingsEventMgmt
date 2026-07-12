import { describe, expect, it } from 'vitest';

import { canEditRota } from '../useRotaPermissions.js';

describe('canEditRota', () => {
  it('allows write-level flexi permission', () => {
    expect(canEditRota({ permissions: { flexi: 20 } })).toBe(true);
    expect(canEditRota({ permissions: { flexi: '100' } })).toBe(true);
  });

  it('denies explicit read-only flexi permission', () => {
    expect(canEditRota({ permissions: { flexi: 10 } })).toBe(false);
    expect(canEditRota({ permissions: { flexi: 0 } })).toBe(false);
  });

  it('errs open when the permission key is absent (OSM enforces server-side)', () => {
    expect(canEditRota({ permissions: {} })).toBe(true);
    expect(canEditRota({})).toBe(true);
    expect(canEditRota(null)).toBe(true);
  });
});
