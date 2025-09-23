/**
 * Simplified page data loading hook
 * Replaces complex sync service usage with simple page-specific data loading
 */

import { useState, useEffect, useCallback } from 'react';
import pageDataManager from '../services/data/pageDataManager.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

/**
 * Hook for loading page-specific data
 * @param {string} pageType - Page type: 'events', 'sections', 'young-leaders', 'movers'
 * @param {object} options - Loading options
 * @returns {object} { data, loading, error, refresh }
 */
export function usePageData(pageType, options = {}) {
  const { autoLoad = true } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState(null);

  const loadPageData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      let pageData;
      if (forceRefresh) {
        // Force refresh clears cache
        pageData = await pageDataManager.refreshPageData(pageType);
      } else {
        // Normal load (uses cache if available)
        switch (pageType) {
        case 'events':
          pageData = await pageDataManager.loadEventsPageData();
          break;
        case 'sections':
          pageData = await pageDataManager.loadSectionsPageData();
          break;
        case 'young-leaders':
          pageData = await pageDataManager.loadYoungLeadersPageData();
          break;
        case 'movers':
          pageData = await pageDataManager.loadMoversPageData();
          break;
        default:
          throw new Error(`Unknown page type: ${pageType}`);
        }
      }

      setData(pageData);

      logger.debug(`${pageType} page data loaded`, {
        sectionsCount: pageData.sections?.length || 0,
        eventsCount: pageData.events ? Object.keys(pageData.events).length : 0,
        membersCount: pageData.members ? Object.keys(pageData.members).length : 0,
      }, LOG_CATEGORIES.UI);

    } catch (err) {
      logger.error(`Failed to load ${pageType} page data`, {
        error: err.message,
        pageType,
      }, LOG_CATEGORIES.ERROR);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [pageType]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadPageData();
    }
  }, [loadPageData, autoLoad]);

  // Refresh function for components
  const refresh = useCallback(() => {
    return loadPageData(true); // Force refresh
  }, [loadPageData]);

  return {
    data,
    loading,
    error,
    refresh,
    reload: () => loadPageData(false), // Normal reload (uses cache)
  };
}

/**
 * Hook for loading event detail data (drill-down)
 * @param {string|number} eventId - Event ID
 * @param {string|number} sectionId - Section ID
 * @param {object} options - Loading options
 * @returns {object} { data, loading, error, refresh }
 */
export function useEventDetailData(eventId, sectionId, options = {}) {
  const { autoLoad = true } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoLoad && eventId && sectionId);
  const [error, setError] = useState(null);

  const loadEventData = useCallback(async () => {
    if (!eventId || !sectionId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const eventData = await pageDataManager.loadEventDetailData(eventId, sectionId);
      setData(eventData);

      logger.debug('Event detail data loaded', {
        eventId,
        sectionId,
        attendanceCount: eventData.attendance?.length || 0,
        membersCount: eventData.members?.length || 0,
      }, LOG_CATEGORIES.UI);

    } catch (err) {
      logger.error('Failed to load event detail data', {
        error: err.message,
        eventId,
        sectionId,
      }, LOG_CATEGORIES.ERROR);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [eventId, sectionId]);

  // Auto-load when eventId or sectionId changes
  useEffect(() => {
    if (autoLoad && eventId && sectionId) {
      loadEventData();
    }
  }, [loadEventData, autoLoad, eventId, sectionId]);

  // Refresh function
  const refresh = useCallback(() => {
    return loadEventData();
  }, [loadEventData]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

export default usePageData;