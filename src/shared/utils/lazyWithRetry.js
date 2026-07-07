import React from 'react';

const RELOAD_FLAG = 'lazy_chunk_reload_attempted';

/**
 * Loads a lazy module, reloading the page once if the chunk fails to import.
 *
 * Hashed chunk filenames change on every deploy, so a tab opened before a
 * deploy can request a chunk that no longer exists ("Importing a module
 * script failed" in Safari), unmounting the app to a blank page. Reloading
 * fetches the current index.html and matching chunks. A sessionStorage flag
 * prevents a reload loop when the import failure is not deploy-related.
 *
 * @param {Function} importFn - The dynamic import function for the module.
 * @returns {Promise<Object>} The imported module.
 * @throws {Error} The original import error when a reload was already attempted.
 */
export async function loadModuleWithReload(importFn) {
  try {
    const module = await importFn();
    sessionStorage.removeItem(RELOAD_FLAG);
    return module;
  } catch (error) {
    if (!sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, 'true');
      window.location.reload();
      return new Promise(() => {});
    }
    throw error;
  }
}

/**
 * Drop-in replacement for React.lazy that recovers from stale-chunk import
 * failures after a deploy by reloading the page once.
 *
 * @param {Function} importFn - Dynamic import returning a module with a default export.
 * @returns {React.LazyExoticComponent} Lazy component with reload recovery.
 *
 * @example
 * const EventsRouter = lazyWithRetry(() =>
 *   import('../features/events/components').then(m => ({ default: m.EventsRouter })));
 */
export function lazyWithRetry(importFn) {
  return React.lazy(() => loadModuleWithReload(importFn));
}
