/**
 * Freshness marker formatting shared by the subs pages.
 *
 * @module formatLoadedAt
 */

/**
 * Formats when a summary was loaded, distinguishing a live read from one
 * served out of a fresh cache.
 *
 * @param {number} [loadedAt] - Milliseconds since the epoch
 * @param {boolean} [fromCache] - Whether the summary came from the cache
 * @returns {string|null} e.g. "Loaded 14:05" or "Cached 14:05", null without a timestamp
 */
export function formatLoadedAt(loadedAt, fromCache) {
  if (!loadedAt) {
    return null;
  }
  const when = new Date(loadedAt);
  if (Number.isNaN(when.getTime())) {
    return null;
  }
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(when);
  return `${fromCache ? 'Cached' : 'Loaded'} ${time}`;
}
