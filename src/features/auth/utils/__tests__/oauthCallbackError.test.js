import { describe, it, expect } from 'vitest';
import { describeOAuthCallbackError } from '../oauthCallbackError.js';

describe('describeOAuthCallbackError', () => {
  it('gives an actionable "OSM busy/blocking — wait and retry" message for token_exchange_failed', () => {
    const message = describeOAuthCallbackError('token_exchange_failed');
    expect(message).toMatch(/OSM/);
    expect(message).toMatch(/wait a few minutes and try again/i);
    // must not leak the raw error code as the whole message
    expect(message).not.toBe('token_exchange_failed');
  });

  it('gives a generic retry message for any other error code, naming it', () => {
    const message = describeOAuthCallbackError('invalid_state');
    expect(message).toMatch(/Sign-in didn’t complete/);
    expect(message).toMatch(/invalid_state/);
  });
});
