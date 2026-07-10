import { describe, expect, it } from 'vitest';

import { myStatusFor, withdrawalNeedsConfirm } from '../rotaDisplay.js';

function view({ confirmed = [], backups = [], needed = 3 } = {}) {
  return {
    confirmed: confirmed.map((id) => ({ scoutid: String(id), name: `P${id}`, status: 'I', at: null })),
    backups: backups.map((id) => ({ scoutid: String(id), name: `P${id}`, status: 'B', at: null })),
    needed,
  };
}

describe('myStatusFor', () => {
  it('finds the user in confirmed and backup lists', () => {
    const session = view({ confirmed: [10], backups: [11] });
    expect(myStatusFor(session, '10')).toBe('I');
    expect(myStatusFor(session, 11)).toBe('B');
    expect(myStatusFor(session, '12')).toBeNull();
    expect(myStatusFor(session, null)).toBeNull();
  });
});

describe('withdrawalNeedsConfirm', () => {
  it('confirms when a confirmed holder leaving drops below the target', () => {
    const session = view({ confirmed: [10, 11], needed: 2 });
    expect(withdrawalNeedsConfirm(session, 'I', null)).toBe(true);
    expect(withdrawalNeedsConfirm(session, 'I', 'B')).toBe(true);
  });

  it('does not confirm when cover survives the withdrawal', () => {
    const session = view({ confirmed: [10, 11, 12], needed: 2 });
    expect(withdrawalNeedsConfirm(session, 'I', null)).toBe(false);
  });

  it('never confirms backup withdrawals or new signups', () => {
    const session = view({ confirmed: [10], backups: [11], needed: 2 });
    expect(withdrawalNeedsConfirm(session, 'B', null)).toBe(false);
    expect(withdrawalNeedsConfirm(session, null, 'I')).toBe(false);
  });

  it('never confirms when no target is set', () => {
    const session = view({ confirmed: [10], needed: null });
    expect(withdrawalNeedsConfirm(session, 'I', null)).toBe(false);
  });
});
