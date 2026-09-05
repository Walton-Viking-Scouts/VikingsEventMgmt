/**
 * OAuth scope inspection for the OSM access token.
 *
 * The finance endpoints require the `section:finance:read` scope, which is
 * only present on tokens issued after the backend added it. The scope is read
 * straight from the JWT payload rather than from `/validate-token`, which
 * always 401s for web logins.
 *
 * @module tokenScopes
 */

/* global atob */

export const FINANCE_SCOPE = 'section:finance:read';

/**
 * Decodes the base64url JWT payload and returns its scopes. OSM issues
 * `scopes` either as an array or as a single space-separated string; both are
 * normalised to an array here.
 *
 * @param {string|null|undefined} token - OSM access token
 * @returns {string[]} The token's scopes, or [] when the token is missing,
 *   not a decodable JWT, or carries no scopes array
 */
export function decodeTokenScopes(token) {
  if (typeof token !== 'string') {
    return [];
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return [];
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    const scopes = payload?.scopes;
    if (Array.isArray(scopes)) {
      return scopes.filter((scope) => typeof scope === 'string');
    }
    if (typeof scopes === 'string') {
      return scopes.split(' ').filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Whether the token grants read access to the finance endpoints.
 *
 * @param {string|null|undefined} token - OSM access token
 * @returns {boolean} True when the token's scopes include `section:finance:read`
 */
export function hasFinanceScope(token) {
  return decodeTokenScopes(token).includes(FINANCE_SCOPE);
}
