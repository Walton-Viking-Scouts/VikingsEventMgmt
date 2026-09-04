/**
 * Loads the subs summary for every section the user may view, strictly one
 * section at a time so OSM sees a single in-flight payment call, stopping the
 * whole load on the first failure. Sections without finance access are kept in
 * the list but never requested. No polling, no retry, no background
 * refresh: only mount and an explicit refresh() trigger a load.
 *
 * @module useSubsSummary
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { hasFinanceScope } from '../../../shared/services/auth/tokenScopes.js';
import { getSubsSections, loadSectionSubs } from '../services/subsService.js';

/**
 * Sequentially loads subs data for all viewable sections.
 *
 * @returns {{
 *   sections: Array<{sectionId: string, sectionName: string, financePermission: number, canView: boolean}>,
 *   summaries: Record<string, object>,
 *   loadingSectionId: string|null,
 *   failedSectionId: string|null,
 *   loading: boolean,
 *   error: Error|null,
 *   needsAuth: boolean,
 *   needsFinanceScope: boolean,
 *   refresh: () => Promise<void>,
 * }} Summary state and an explicit refresh trigger
 */
export function useSubsSummary() {
  const [sections, setSections] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loadingSectionId, setLoadingSectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsFinanceScope, setNeedsFinanceScope] = useState(false);
  const [failedSectionId, setFailedSectionId] = useState(null);
  const runIdRef = useRef(0);

  const load = useCallback(async (forceRefresh) => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    setFailedSectionId(null);

    const token = getToken();
    if (!hasFinanceScope(token)) {
      setNeedsFinanceScope(true);
      setSections([]);
      setSummaries({});
      setLoadingSectionId(null);
      setLoading(false);
      return;
    }
    setNeedsFinanceScope(false);

    let viewable = [];
    try {
      viewable = await getSubsSections();
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err);
      setNeedsAuth(Boolean(err?.needsAuth));
      setLoading(false);
      return;
    }
    if (runIdRef.current !== runId) return;

    setSections(viewable);
    setSummaries({});

    for (const section of viewable) {
      if (runIdRef.current !== runId) return;
      if (!section.canView) continue;
      setLoadingSectionId(section.sectionId);
      try {
        const summary = await loadSectionSubs(section.sectionId, { token, forceRefresh });
        if (runIdRef.current !== runId) return;
        setSummaries((previous) => ({ ...previous, [section.sectionId]: summary }));
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setError(err);
        setNeedsAuth(Boolean(err?.needsAuth));
        setFailedSectionId(section.sectionId);
        setLoadingSectionId(null);
        setLoading(false);
        return;
      }
    }

    if (runIdRef.current !== runId) return;
    setLoadingSectionId(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    sections,
    summaries,
    loadingSectionId,
    failedSectionId,
    loading,
    error,
    needsAuth,
    needsFinanceScope,
    refresh,
  };
}

export default useSubsSummary;
