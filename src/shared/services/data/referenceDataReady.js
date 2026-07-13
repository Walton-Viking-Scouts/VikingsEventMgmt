/**
 * Reference-data readiness signal.
 *
 * The post-login bootstrap (dataLoadingService) loads reference data
 * (terms/sections/members) first, then a heavy tail (all-section events,
 * attendance, flexi). Page-first loaders that depend on cached reference data
 * — notably the water rota's `loadRota`, which scans cached sections/terms/
 * members — mount and run before that reference step finishes on a cold cache,
 * so they find nothing and, having no re-run trigger, stay empty.
 *
 * This module is the single source of truth for "reference data is now cached
 * this session": the bootstrap calls {@link markReferenceDataReady} once the
 * reference step succeeds, and page loaders subscribe to re-run themselves.
 *
 * @module referenceDataReady
 */

let ready = false;
const listeners = new Set();

/**
 * Whether reference data has been loaded into the cache this session.
 *
 * @returns {boolean} True once the bootstrap's reference step has succeeded
 */
export function isReferenceDataReady() {
  return ready;
}

/**
 * Mark reference data as ready and notify every subscriber. Idempotent — safe
 * to call again on refresh paths; each call re-notifies so late-mounted
 * loaders still get nudged.
 *
 * @returns {void}
 */
export function markReferenceDataReady() {
  ready = true;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A misbehaving subscriber must not stop the others being notified.
    }
  }
}

/**
 * Clear readiness (e.g. on logout, before the cache is wiped), so the next
 * session's cold-cache loaders wait for a fresh reference load instead of
 * acting on the previous session's stale signal.
 *
 * @returns {void}
 */
export function resetReferenceDataReady() {
  ready = false;
}

/**
 * Subscribe to reference-data-ready notifications.
 *
 * @param {() => void} listener - Called each time reference data is marked ready
 * @returns {() => void} Unsubscribe function
 */
export function subscribeReferenceDataReady(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
