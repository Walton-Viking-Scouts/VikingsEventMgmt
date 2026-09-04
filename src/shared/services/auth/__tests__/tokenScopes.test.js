/* global btoa */

import { describe, it, expect } from 'vitest';
import { decodeTokenScopes, hasFinanceScope, FINANCE_SCOPE } from '../tokenScopes.js';

function makeToken(payload) {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${body}.signature`;
}

describe('decodeTokenScopes', () => {
  it('returns the scopes array from the JWT payload', () => {
    const token = makeToken({ scopes: ['section:member:read', FINANCE_SCOPE] });
    expect(decodeTokenScopes(token)).toEqual(['section:member:read', FINANCE_SCOPE]);
  });

  it('accepts a space-delimited scopes string', () => {
    expect(decodeTokenScopes(makeToken({ scopes: `a ${FINANCE_SCOPE}` }))).toEqual(['a', FINANCE_SCOPE]);
  });

  it('returns [] for missing, malformed and non-JWT tokens', () => {
    expect(decodeTokenScopes(null)).toEqual([]);
    expect(decodeTokenScopes('')).toEqual([]);
    expect(decodeTokenScopes('not-a-jwt')).toEqual([]);
    expect(decodeTokenScopes('a.!!!.c')).toEqual([]);
    expect(decodeTokenScopes(makeToken({ sub: 'x' }))).toEqual([]);
  });
});

describe('hasFinanceScope', () => {
  it('is true only when the finance scope is present', () => {
    expect(hasFinanceScope(makeToken({ scopes: [FINANCE_SCOPE] }))).toBe(true);
    expect(hasFinanceScope(makeToken({ scopes: ['section:member:read'] }))).toBe(false);
    expect(hasFinanceScope(null)).toBe(false);
  });
});
