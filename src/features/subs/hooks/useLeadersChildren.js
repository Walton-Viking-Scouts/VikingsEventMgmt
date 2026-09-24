/**
 * Loads the Leaders' children view: the cached young people whose primary
 * contacts match an adult leader, grouped by section, plus the subs summary
 * of each section that has such a child and that the user may view. Subs are
 * loaded one section at a time and only for sections with a match, so OSM
 * sees a single in-flight payment call and no call it does not need. A
 * section rejected before any network call (err.localOnly) is marked and
 * skipped; the first failed network call stops the run. Only mount and an
 * explicit refresh() trigger a load.
 *
 * @module useLeadersChildren
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { hasFinanceScope } from '../../../shared/services/auth/tokenScopes.js';
import { getSubsSections, loadLeadersChildren, loadSectionSubs } from '../services/subsService.js';

/**
 * Loads the matched children and, where permitted, their sections' subs.
 *
 * @returns {{
 *   sections: Array<{sectionId: string, sectionName: string, children: Array<Object>, canView: boolean, permissionsSynced: boolean}>,
 *   summaries: Record<string, object>,
 *   loadingSectionId: string|null,
 *   failedSectionId: string|null,
 *   sectionErrors: Record<string, {code: string, message: string}>,
 *   loading: boolean,
 *   error: Error|null,
 *   needsAuth: boolean,
 *   needsFinanceScope: boolean,
 *   refresh: () => Promise<void>,
 * }} View state and an explicit refresh trigger
 */
export function useLeadersChildren() {
  const [sections, setSections] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loadingSectionId, setLoadingSectionId] = useState(null);
  const [failedSectionId, setFailedSectionId] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});
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
    setFailedSectionId(null);
    setSectionErrors({});
    setLoadingSectionId(null);
    setSummaries({});

    let matched = [];
    let access = [];
    try {
      [matched, access] = await Promise.all([loadLeadersChildren(), getSubsSections()]);
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setError(err);
      setLoading(false);
      return;
    }
    if (runIdRef.current !== runId) return;

    const accessById = new Map(access.map((section) => [section.sectionId, section]));
    const merged = matched.map((section) => ({
      ...section,
      canView: Boolean(accessById.get(section.sectionId)?.canView),
      permissionsSynced: accessById.get(section.sectionId)?.permissionsSynced !== false,
    }));
    setSections(merged);

    const token = getToken();
    if (!hasFinanceScope(token)) {
      setNeedsFinanceScope(true);
      setLoading(false);
      return;
    }
    setNeedsFinanceScope(false);

    for (const section of merged) {
      if (runIdRef.current !== runId) return;
      if (!section.canView || section.children.length === 0) continue;
      setLoadingSectionId(section.sectionId);
      try {
        const summary = await loadSectionSubs(section.sectionId, { token, forceRefresh });
        if (runIdRef.current !== runId) return;
        setSummaries((previous) => ({ ...previous, [section.sectionId]: summary }));
      } catch (err) {
        if (runIdRef.current !== runId) return;
        if (err?.localOnly) {
          setSectionErrors((previous) => ({
            ...previous,
            [section.sectionId]: { code: err.code, message: err.message },
          }));
          setLoadingSectionId(null);
          continue;
        }
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
    sectionErrors,
    loading,
    error,
    needsAuth,
    needsFinanceScope,
    refresh,
  };
}

export default useLeadersChildren;
