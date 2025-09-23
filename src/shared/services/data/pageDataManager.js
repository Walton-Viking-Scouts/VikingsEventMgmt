/**
 * Simplified Page Data Manager
 * Replaces complex sync orchestration with simple page-specific data loading
 * Maintains offline-first approach and rate limiting protection
 */

import databaseService from '../storage/database.js';
import {
  getUserRoles,
  getEvents,
  getEventAttendance,
  fetchMostRecentTermId,
  getTerms,
  getMembersGrid,
  apiQueue,
} from '../api/api.js';
import { getToken } from '../auth/tokenService.js';
import { checkNetworkStatus } from '../../utils/networkUtils.js';
import { getMostRecentTermId } from '../../utils/termUtils.js';
import logger from '../utils/logger.js';

class PageDataManager {
  constructor() {
    this.rateLimitQueue = apiQueue; // Reuse existing rate limiting
    this.cache = new Map(); // In-memory cache for page data
  }

  /**
   * Check if cached data is stale
   */
  isStale(cached, ttlMs) {
    if (!cached || !cached.timestamp) return true;
    return Date.now() - cached.timestamp > ttlMs;
  }

  /**
   * ONE-TIME STARTUP DATA
   * Load core data that rarely changes - cache indefinitely
   */
  async loadStartupData() {
    const cacheKey = 'startup-data';
    const cached = this.cache.get(cacheKey);

    // Use cached data if available and not explicitly stale
    if (cached && !this.isStale(cached, 60 * 60 * 1000)) { // 1 hour TTL
      return cached.data;
    }

    // Try IndexedDB cache first (offline-first)
    try {
      const dbCached = await databaseService.get('page_cache_startup-data');
      if (dbCached && !this.isStale(dbCached, 60 * 60 * 1000)) {
        this.cache.set(cacheKey, dbCached);
        return dbCached.data;
      }
    } catch (error) {
      logger.warn('Failed to get cached startup data', { error: error.message });
    }

    // If online, fetch fresh data
    if (await checkNetworkStatus()) {
      try {
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        // Load core data in parallel (safe for rate limiting)
        const [sections, terms] = await Promise.all([
          this.rateLimitQueue.add(() => getUserRoles(token)),
          this.rateLimitQueue.add(() => getTerms(token)),
        ]);

        const data = { sections, terms };
        const cachedData = { data, timestamp: Date.now() };

        // Cache in memory and IndexedDB
        this.cache.set(cacheKey, cachedData);
        try {
          await databaseService.set('page_cache_startup-data', cachedData);
        } catch (cacheError) {
          logger.warn('Failed to cache startup data', { error: cacheError.message });
        }

        return data;
      } catch (error) {
        logger.error('Failed to load startup data from API', { error: error.message });
        // Fall through to return cached data even if stale
      }
    }

    // Return stale cached data if available (offline fallback)
    if (cached) {
      logger.info('Using stale cached startup data');
      return cached.data;
    }

    // Last resort: empty data
    return { sections: [], terms: {} };
  }

  /**
   * EVENTS PAGE DATA
   * Load sections + terms + events for all sections
   */
  async loadEventsPageData() {
    const cacheKey = 'events-page-data';
    const cached = this.cache.get(cacheKey);

    // Check cache first
    if (cached && !this.isStale(cached, 30 * 60 * 1000)) { // 30min TTL
      return cached.data;
    }

    try {
      const dbCached = await databaseService.get('page_cache_events-page');
      if (dbCached && !this.isStale(dbCached, 30 * 60 * 1000)) {
        this.cache.set(cacheKey, dbCached);
        return dbCached.data;
      }
    } catch (error) {
      logger.warn('Failed to get cached events page data', { error: error.message });
    }

    // If online, fetch fresh data
    if (await checkNetworkStatus()) {
      try {
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        // Get startup data first
        const { sections, terms } = await this.loadStartupData();

        // Load events for each section sequentially (rate limiting protection)
        const eventsData = {};
        for (const section of sections) {
          try {
            const termId = getMostRecentTermId(section.sectionid, terms);
            if (termId) {
              const events = await this.rateLimitQueue.add(() =>
                getEvents(section.sectionid, termId, token),
              );
              eventsData[section.sectionid] = events;
            }
          } catch (sectionError) {
            logger.warn(`Failed to load events for section ${section.sectionid}`, {
              error: sectionError.message,
            });
            // Continue with other sections
          }
        }

        // Load Viking Event Mgmt FlexiRecord data for each section
        await this.loadVikingEventFlexiRecordData(sections, token);

        const data = { sections, terms, events: eventsData };
        const cachedData = { data, timestamp: Date.now() };

        // Cache the results
        this.cache.set(cacheKey, cachedData);
        try {
          await databaseService.set('page_cache_events-page', cachedData);
        } catch (cacheError) {
          logger.warn('Failed to cache events page data', { error: cacheError.message });
        }

        return data;
      } catch (error) {
        logger.error('Failed to load events page data from API', { error: error.message });
      }
    }

    // Return cached data even if stale (offline fallback)
    if (cached) {
      logger.info('Using stale cached events page data');
      return cached.data;
    }

    // Last resort: startup data only
    const startupData = await this.loadStartupData();
    return { ...startupData, events: {} };
  }

  /**
   * SECTIONS PAGE DATA
   * Load sections + terms + members (NO events data needed)
   */
  async loadSectionsPageData() {
    const cacheKey = 'sections-page-data';
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isStale(cached, 30 * 60 * 1000)) {
      return cached.data;
    }

    try {
      const dbCached = await databaseService.get('page_cache_sections-page');
      if (dbCached && !this.isStale(dbCached, 30 * 60 * 1000)) {
        this.cache.set(cacheKey, dbCached);
        return dbCached.data;
      }
    } catch (error) {
      logger.warn('Failed to get cached sections page data', { error: error.message });
    }

    if (await checkNetworkStatus()) {
      try {
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        const { sections, terms } = await this.loadStartupData();

        // Load members for all sections sequentially
        const membersData = {};
        for (const section of sections) {
          try {
            const members = await this.rateLimitQueue.add(() =>
              getMembersGrid(section.sectionid, token),
            );
            membersData[section.sectionid] = members;
          } catch (sectionError) {
            logger.warn(`Failed to load members for section ${section.sectionid}`, {
              error: sectionError.message,
            });
          }
        }

        const data = { sections, terms, members: membersData };
        const cachedData = { data, timestamp: Date.now() };

        this.cache.set(cacheKey, cachedData);
        try {
          await databaseService.set('page_cache_sections-page', cachedData);
        } catch (cacheError) {
          logger.warn('Failed to cache sections page data', { error: cacheError.message });
        }

        return data;
      } catch (error) {
        logger.error('Failed to load sections page data from API', { error: error.message });
      }
    }

    if (cached) {
      logger.info('Using stale cached sections page data');
      return cached.data;
    }

    const startupData = await this.loadStartupData();
    return { ...startupData, members: {} };
  }

  /**
   * YOUNG LEADERS PAGE DATA
   * Same as sections but may filter members by age
   */
  async loadYoungLeadersPageData() {
    // For now, same as sections page
    // TODO: Add age filtering if needed
    return this.loadSectionsPageData();
  }

  /**
   * MOVERS PAGE DATA
   * Same as sections but may include movement data
   */
  async loadMoversPageData() {
    // For now, same as sections page
    // TODO: Add movers-specific data if needed
    return this.loadSectionsPageData();
  }

  /**
   * EVENT DETAIL DATA (Drill-down)
   * Load attendance + members for specific event
   * NOTE: FlexiRecord data handling preserved for separate implementation
   */
  async loadEventDetailData(eventId, sectionId) {
    const _cacheKey = `event-detail-${eventId}-${sectionId}`;

    try {
      const dbCached = await databaseService.get(`event_detail_${eventId}_${sectionId}`);
      if (dbCached && !this.isStale(dbCached, 15 * 60 * 1000)) { // 15min TTL
        return dbCached.data;
      }
    } catch (error) {
      logger.warn('Failed to get cached event detail data', { error: error.message });
    }

    if (await checkNetworkStatus()) {
      try {
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        const termId = await this.rateLimitQueue.add(() =>
          fetchMostRecentTermId(sectionId, token),
        );

        // Load event-specific data in parallel
        const [attendance, members] = await Promise.all([
          this.rateLimitQueue.add(() =>
            getEventAttendance(sectionId, eventId, termId, token),
          ),
          this.rateLimitQueue.add(() =>
            getMembersGrid(sectionId, token),
          ),
          // NOTE: FlexiRecord calls intentionally omitted - will be handled separately
        ]);

        const data = {
          attendance,
          members,
          eventId,
          sectionId,
          termId,
        };
        const cachedData = { data, timestamp: Date.now() };

        try {
          await databaseService.set(`event_detail_${eventId}_${sectionId}`, cachedData);
        } catch (cacheError) {
          logger.warn('Failed to cache event detail data', { error: cacheError.message });
        }

        return data;
      } catch (error) {
        logger.error('Failed to load event detail data from API', { error: error.message });
      }
    }

    // Return empty data as fallback
    return {
      attendance: [],
      members: [],
      eventId,
      sectionId,
      termId: null,
    };
  }

  /**
   * REFRESH DATA
   * Force refresh of specific page data
   */
  async refreshPageData(pageType) {
    const cacheKeys = {
      startup: 'startup-data',
      events: 'events-page-data',
      sections: 'sections-page-data',
      'young-leaders': 'sections-page-data',
      movers: 'sections-page-data',
    };

    // Clear caches
    const cacheKey = cacheKeys[pageType];
    if (cacheKey) {
      this.cache.delete(cacheKey);
    }

    // Reload data
    switch (pageType) {
    case 'startup':
      return this.loadStartupData();
    case 'events':
      return this.loadEventsPageData();
    case 'sections':
      return this.loadSectionsPageData();
    case 'young-leaders':
      return this.loadYoungLeadersPageData();
    case 'movers':
      return this.loadMoversPageData();
    default:
      throw new Error(`Unknown page type: ${pageType}`);
    }
  }
}

// Export singleton instance
export default new PageDataManager();