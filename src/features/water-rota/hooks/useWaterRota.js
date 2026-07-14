/**
 * Discovers the season buckets that have rota records and loads one bucket's
 * aggregated group view.
 *
 * Reads ride the flexi cache underneath discoverRotaRecords/loadRotaGroup, so
 * a previously loaded board renders offline; refresh() re-runs discovery and
 * every record's live grid fetch.
 *
 * Deep-link fast path: on a cold cache (a shared-link recipient who just
 * signed in) discovery cannot find any record until the post-login bootstrap
 * has cached sections/terms/members, so this hook (a) waits in the loading
 * state rather than flashing "no rota" while reference data is still
 * loading, (b) re-runs once {@link subscribeReferenceDataReady} fires or the
 * bootstrap otherwise settles (so a reference *failure* resolves to the
 * empty/error state instead of hanging), and (c) loads at a raised
 * rate-limit priority so the rota jumps ahead of the background sync. A
 * per-request epoch guard ensures a slower stale load can't clobber the
 * result of a newer one. The same ready-signal gating covers the season
 * picker's bucket list, since discovery is what produces it.
 *
 * @module useWaterRota
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import dataLoadingService from '../../../shared/services/data/dataLoadingService.js';
import {
  isReferenceDataReady,
  subscribeReferenceDataReady,
} from '../../../shared/services/data/referenceDataReady.js';
import { discoverRotaRecords, loadRotaGroup } from '../services/rotaService.js';
import { seasonBucketForRange } from '../services/rotaTemplates.js';

// Queue priority for the landing/deep-link rota load: above the background
// post-login reads (0), below writes (10), so a shared-link recipient's board
// loads ahead of the whole-app sync.
const DEEP_LINK_PRIORITY = 5;

const SEASON_ORDER = { Spring: 0, Summer: 1, Autumn: 2 };

/**
 * Parse a season bucket label into its comparable parts.
 *
 * @param {string} bucket - Season bucket label, e.g. "Summer 2026"
 * @returns {{season: string, year: number}|null} Parts, or null when unparseable
 */
function parseSeasonBucket(bucket) {
  const match = /^(Spring|Summer|Autumn) (\d{4})$/.exec(String(bucket ?? '').trim());
  return match ? { season: match[1], year: Number(match[2]) } : null;
}

/**
 * Every distinct season bucket a set of discovered records belongs to.
 *
 * @param {Array<{seasonBucket: string}>} descriptors - Discovered rota descriptors
 * @returns {string[]} Unique season buckets, unordered
 */
export function uniqueSeasonBuckets(descriptors) {
  return [...new Set((descriptors ?? []).map((descriptor) => descriptor.seasonBucket))];
}

/**
 * Pick the season picker's default bucket (PRD §3.4): the bucket whose
 * season window contains today, else the latest bucket by (year, season
 * order).
 *
 * @param {string[]} buckets - Available season buckets
 * @param {string} [todayISO] - Today's date (yyyy-mm-dd), injectable for tests
 * @returns {string|null} The default bucket, or null when there are none
 */
export function defaultSeasonBucket(buckets, todayISO = format(new Date(), 'yyyy-MM-dd')) {
  if (!buckets || buckets.length === 0) {
    return null;
  }
  const currentBucket = seasonBucketForRange(todayISO, todayISO);
  if (buckets.includes(currentBucket)) {
    return currentBucket;
  }
  return [...buckets].sort((a, b) => {
    const pa = parseSeasonBucket(a);
    const pb = parseSeasonBucket(b);
    if (!pa || !pb) {
      return String(a).localeCompare(String(b));
    }
    return pa.year - pb.year || SEASON_ORDER[pa.season] - SEASON_ORDER[pb.season];
  }).at(-1);
}

/**
 * Load the water rota for a season bucket, aggregating every discovered
 * planning section's record in that bucket.
 *
 * @param {string} [seasonBucket] - Season bucket to load, e.g. "Summer 2026"; defaults to {@link defaultSeasonBucket}
 * @returns {{loading: boolean, rota: import('../services/rotaService.js').RotaGroup|null, error: Error|null, refresh: Function, seasonBucket: string|null, buckets: string[]}} Rota state
 */
export function useWaterRota(seasonBucket) {
  const [state, setState] = useState({
    loading: true, rota: null, error: null, seasonBucket: null, buckets: [],
  });
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    // Latest-request-wins: a slower earlier load (e.g. the cold-cache mount
    // load returning null) must not overwrite a newer load's result.
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;

    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const token = getToken();
      const descriptors = await discoverRotaRecords(token, DEEP_LINK_PRIORITY);
      if (!isCurrent()) {
        return;
      }
      const buckets = uniqueSeasonBuckets(descriptors);
      // A well-formed but non-existent bucket (e.g. a stale shared link)
      // must not stick — fall back to the resolved default once buckets are
      // known. While discovery hasn't populated buckets yet (cold-cache
      // deep link), keep the requested bucket so that path still works.
      const activeBucket = buckets.length === 0
        ? seasonBucket
        : (seasonBucket && buckets.includes(seasonBucket) ? seasonBucket : defaultSeasonBucket(buckets));
      const rota = activeBucket
        ? await loadRotaGroup(activeBucket, token, { priority: DEEP_LINK_PRIORITY })
        : null;
      if (!isCurrent()) {
        return;
      }

      if (
        !rota &&
        buckets.length === 0 &&
        !isReferenceDataReady() &&
        dataLoadingService.getLoadingStatus().isLoadingAll
      ) {
        // Cold-cache deep link with the post-login bootstrap still running:
        // sections aren't cached yet, so discovery finding nothing means "not
        // loaded" not "no rota exists". Stay in loading and let the
        // reference-ready signal re-run this once the cache is warm. Gated
        // on an in-progress load so a warm-cache/offline user viewing a
        // bucket with genuinely no rota falls through to the empty state
        // below instead of spinning forever.
        setState((previous) => ({ ...previous, loading: true }));
        // Safety net: if the bootstrap settles WITHOUT caching reference data
        // (reference load failed), the ready signal never fires — re-run once
        // it terminates so we resolve to the empty/error state, never hang.
        // On the success path the ready signal already re-ran us, so skip the
        // recovery reload when reference did become ready.
        dataLoadingService.whenAllDataSettled().then(() => {
          if (mountedRef.current && !isReferenceDataReady()) {
            refresh();
          }
        });
        return;
      }
      setState({ loading: false, rota, error: null, seasonBucket: activeBucket, buckets });
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      logger.error('Water rota load failed', {
        seasonBucket,
        error: error.message,
      }, LOG_CATEGORIES.ERROR);
      setState({ loading: false, rota: null, error, seasonBucket: null, buckets: [] });
    }
  }, [seasonBucket]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  return { ...state, refresh };
}
