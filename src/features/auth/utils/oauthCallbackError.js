/**
 * OAuth callback error handling: turn the backend's `?error=` redirect param
 * into a plain-English, actionable message for the user.
 *
 * The backend redirects to the frontend with `?error=<code>&details=<json>`
 * when the OSM token exchange fails. The frontend previously ignored this
 * entirely, so a failed sign-in landed the user on a cryptic URL with no
 * explanation (notably when OSM returns an HTML block/error page instead of a
 * token — the "OSM has blocked the app" case).
 *
 * @module oauthCallbackError
 */

/**
 * Map an OAuth callback `error` code to a user-facing message.
 *
 * `token_exchange_failed` is the common OSM-side failure: OSM returned a
 * non-token response (typically an HTML block/error page), so the message is
 * actionable — stop and wait, since retrying just hits OSM again.
 *
 * @param {string} error - The `error` query param from the OAuth callback
 * @returns {string} A plain-English message for the user
 */
export function describeOAuthCallbackError(error) {
  if (error === 'token_exchange_failed') {
    return 'Couldn’t complete sign-in — OSM looks busy or is temporarily blocking the app (too many requests). Wait a few minutes and try again.';
  }
  return `Sign-in didn’t complete (${error}). Please try again in a moment.`;
}
