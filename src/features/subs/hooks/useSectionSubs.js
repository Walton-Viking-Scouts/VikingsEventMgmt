/**
 * Loads one section's subs summary for the drill-down page. One load per user
 * action: mount and refresh() only, with no retry or polling.
 *
 * @module useSectionSubs
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { hasFinanceScope } from '../../../shared/services/auth/tokenScopes.js';
import { loadSectionSubs } from '../services/subsService.js';

/**
 * Loads the subs summary for a single section.
 *
 * @param {string} sectionId - OSM section id to load
 * @returns {{
 *   summary: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   needsAuth: boolean,
 *   needsFinanceScope: boolean,
 *   refresh: () => Promise<void>,
 * }} Section state and an explicit refresh trigger
 */
export function useSectionSubs(sectionId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsFinanceScope, setNeedsFinanceScope] = useState(false);
  const runIdRef = useRef(0);

  const load = useCallback(async (forceRefresh) => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setLoading(true);
    setError(null);
    setNeedsAuth(false);

    const token = getToken();
    if (!hasFinanceScope(token)) {
      setNeedsFinanceScope(true);
      setSummary(null);
      setLoading(false);
      return;
    }
    setNeedsFinanceScope(false);

    try {
      const loaded = await loadSectionSubs(sectionId, { token, forceRefresh });
      if (runIdRef.current !== runId) return;
      setSummary(loaded);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err);
      setNeedsAuth(Boolean(err?.needsAuth));
    } finally {
      if (runIdRef.current === runId) {
        setLoading(false);
      }
    }
  }, [sectionId]);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { summary, loading, error, needsAuth, needsFinanceScope, refresh };
}

export default useSectionSubs;
