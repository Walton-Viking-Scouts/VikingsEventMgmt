/* global CustomEvent */
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

const OAUTH_CALLBACK_SCHEME = 'vikings://oauth-callback';

/**
 * Parse OAuth callback parameters from a deep-link URL.
 *
 * Supports tokens passed either in the query string or the URL fragment
 * (the OAuth implicit-flow style `#access_token=...`).
 *
 * @param {string} callbackUrl - Full deep-link URL including scheme.
 * @returns {{ accessToken: string|null, tokenType: string|null, expiresIn: string|null }}
 */
function parseCallbackParams(callbackUrl) {
  const url = new URL(callbackUrl);
  const search = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(
    url.hash && url.hash.startsWith('#') ? url.hash.slice(1) : url.hash || '',
  );
  const pick = (key) => search.get(key) || fragment.get(key);
  return {
    accessToken: pick('access_token'),
    tokenType: pick('token_type'),
    expiresIn: pick('expires_in'),
  };
}

/**
 * Initiate the OAuth login flow.
 *
 * On the web platform this performs a standard full-page redirect by
 * assigning `window.location.href`. On native iOS it opens the supplied
 * authorization URL in an SFSafariViewController via `@capacitor/browser`,
 * listens for the `vikings://oauth-callback` deep link via `@capacitor/app`,
 * dismisses the in-app browser, and dispatches a `oauth-callback`
 * `CustomEvent` on `window` whose `detail` contains `accessToken`,
 * `tokenType`, and `expiresIn` extracted from the callback URL.
 *
 * Listeners are scoped per call: each invocation captures its own handles
 * and removes them on completion (callback fired or browser dismissed by
 * the user). Wave-2 callers should subscribe to the `oauth-callback`
 * window event to receive the token payload.
 *
 * @param {string} authUrl - The provider authorization URL to open.
 * @returns {Promise<void>} Resolves once the native browser has been opened
 *   (web path resolves after assigning `location.href`). The eventual token
 *   delivery happens asynchronously via the `oauth-callback` window event.
 */
export async function loginNative(authUrl) {
  if (Capacitor.getPlatform() === 'web') {
    window.location.href = authUrl;
    return;
  }

  let urlOpenHandle = null;
  let browserFinishedHandle = null;
  let settled = false;

  const cleanup = async () => {
    if (settled) return;
    settled = true;
    try {
      if (urlOpenHandle && typeof urlOpenHandle.remove === 'function') {
        await urlOpenHandle.remove();
      }
    } catch (err) {
      logger.error(
        'Failed to remove appUrlOpen listener',
        { error: err?.message },
        LOG_CATEGORIES.AUTH,
      );
    }
    try {
      if (
        browserFinishedHandle &&
        typeof browserFinishedHandle.remove === 'function'
      ) {
        await browserFinishedHandle.remove();
      }
    } catch (err) {
      logger.error(
        'Failed to remove browserFinished listener',
        { error: err?.message },
        LOG_CATEGORIES.AUTH,
      );
    }
  };

  urlOpenHandle = await App.addListener('appUrlOpen', async (event) => {
    const incomingUrl = event?.url || '';
    if (!incomingUrl.startsWith(OAUTH_CALLBACK_SCHEME)) {
      return;
    }

    let detail = { accessToken: null, tokenType: null, expiresIn: null };
    try {
      detail = parseCallbackParams(incomingUrl);
    } catch (err) {
      logger.error(
        'Failed to parse OAuth callback URL',
        { error: err?.message },
        LOG_CATEGORIES.AUTH,
      );
    }

    try {
      await Browser.close();
    } catch (err) {
      logger.error(
        'Failed to close in-app browser after OAuth callback',
        { error: err?.message },
        LOG_CATEGORIES.AUTH,
      );
    }

    await cleanup();

    window.dispatchEvent(new CustomEvent('oauth-callback', { detail }));

    logger.info('Native OAuth completed', {}, LOG_CATEGORIES.AUTH);
  });

  browserFinishedHandle = await Browser.addListener(
    'browserFinished',
    async () => {
      await cleanup();
    },
  );

  await Browser.open({ url: authUrl });
}
