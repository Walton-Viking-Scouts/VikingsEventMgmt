/**
 * Loads and exposes the current year's water rota.
 *
 * Reads ride the flexi cache underneath loadRota, so a previously loaded
 * board renders offline; refresh() re-runs discovery and the live grid
 * fetch.
 *
 * Deep-link fast path: on a cold cache (a shared-link recipient who just
 * signed in) loadRota cannot discover the record until the post-login
 * bootstrap has cached sections/terms/members. This hook therefore (a) waits
 * in the loading state rather than flashing "no rota" while reference data is
 * still loading, (b) re-runs once {@link subscribeReferenceDataReady} fires,
 * and (c) loads at a raised rate-limit priority so the rota jumps ahead of the
 * background sync's flood of requests.
 *
 * @module useWaterRota
 */

import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import dataLoadingService from '../../../shared/services/data/dataLoadingService.js';
import {
  isReferenceDataReady,
  subscribeReferenceDataReady,
} from '../../../shared/services/data/referenceDataReady.js';
import { loadRota } from '../services/rotaService.js';

// Queue priority for the landing/deep-link rota load: above the background
// post-login reads (0), below writes (10), so a shared-link recipient's board
// loads ahead of the whole-app sync.
const DEEP_LINK_PRIORITY = 5;

/**
 * Load the water rota for a year.
 *
 * @param {number} [year] - Calendar year; defaults to the current year
 * @returns {{loading: boolean, rota: Object|null, error: Error|null, refresh: Function, year: number}} Rota state
 */
export function useWaterRota(year) {
  const targetYear = year ?? new Date().getFullYear();
  const [state, setState] = useState({ loading: true, rota: null, error: null });

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const token = getToken();
      const rota = await loadRota(targetYear, token, { priority: DEEP_LINK_PRIORITY });
      if (
        !rota &&
        !isReferenceDataReady() &&
        dataLoadingService.getLoadingStatus().isLoadingAll
      ) {
        // Cold-cache deep link with the post-login bootstrap still running:
        // sections aren't cached yet, so a null result means "not loaded" not
        // "no rota exists". Stay in loading and let the reference-ready signal
        // re-run this once the cache is warm. Gated on an in-progress load so a
        // warm-cache/offline user viewing a year with genuinely no rota falls
        // through to the empty state below instead of spinning forever.
        setState((previous) => ({ ...previous, loading: true }));
        return;
      }
      setState({ loading: false, rota, error: null });
    } catch (error) {
      logger.error('Water rota load failed', {
        year: targetYear,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      setState({ loading: false, rota: null, error });
    }
  }, [targetYear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Re-run when the post-login bootstrap finishes caching reference data, so
    // a cold-cache recipient's board fills in without a manual refresh.
    return subscribeReferenceDataReady(() => {
      refresh();
    });
  }, [refresh]);

  return { ...state, refresh, year: targetYear };
}
