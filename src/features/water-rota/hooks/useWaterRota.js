/**
 * Loads and exposes the current year's water rota.
 *
 * Reads ride the flexi cache underneath loadRota, so a previously loaded
 * board renders offline; refresh() re-runs discovery and the live grid
 * fetch.
 *
 * @module useWaterRota
 */

import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { loadRota } from '../services/rotaService.js';

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
      const rota = await loadRota(targetYear, token);
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

  return { ...state, refresh, year: targetYear };
}
