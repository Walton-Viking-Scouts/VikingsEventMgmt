import databaseService from './database.js';
import { getUserRoles, getEvents, getEventAttendance, fetchMostRecentTermId, getTerms, getMembersGrid } from '../api/api.js';
import { getToken, generateOAuthUrl, validateToken } from '../auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../utils/logger.js';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { checkNetworkStatus } from '../../utils/networkUtils.js';

/**
 * Service for managing data synchronization between local storage and OSM API.
 * Provides offline-first functionality with authentication handling and rate limiting.
 */
class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.loginPromptCallbacks = [];
  }

  // Add listener for sync status changes
  /**
   * Adds a listener for sync status changes.
   * @param {Function} callback - Callback function to be called when sync status changes
   */
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  // Remove sync listener
  /**
   * Removes a sync status change listener.
   * @param {Function} callback - Callback function to remove from listeners
   */
  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
  }

  // Add listener for login prompt requests
  /**
   * Adds a listener for login prompt requests.
   * @param {Function} callback - Callback function to handle login prompts
   */
  addLoginPromptListener(callback) {
    this.loginPromptCallbacks.push(callback);
  }

  // Remove login prompt listener
  /**
   * Removes a login prompt listener.
   * @param {Function} callback - Callback function to remove from listeners
   */
  removeLoginPromptListener(callback) {
    this.loginPromptCallbacks = this.loginPromptCallbacks.filter(cb => cb !== callback);
  }

  // Notify listeners of sync status
  /**
   * Notifies all listeners of sync status changes.
   * @param {object} status - Status object containing sync information
   */
  notifyListeners(status) {
    this.syncListeners.forEach(callback => callback(status));
  }

  // Notify listeners to show login prompt
  /**
   * Shows login prompt to user and handles their response.
   * @returns {Promise<boolean>} Promise resolving to true if user confirms login, false otherwise
   */
  showLoginPrompt() {
    return new Promise((resolve) => {
      this.loginPromptCallbacks.forEach(callback => {
        callback({
          message: 'Authentication required to sync data. Would you like to login?',
          onConfirm: () => {
            // Redirect to OSM OAuth
            const oauthUrl = generateOAuthUrl();
            window.location.href = oauthUrl;
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      });
    });
  }

  // Check if we're online
  /**
   * Checks if the device is online using Capacitor Network plugin or navigator.
   * @returns {Promise<boolean>} Promise resolving to true if online, false otherwise
   */
  async isOnline() {
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      return status.connected;
    } else {
      return navigator.onLine;
    }
  }

  // Check if we have a valid token before syncing
  /**
   * Checks authentication token validity and prompts for login if needed.
   * @returns {Promise<boolean>} Promise resolving to true if valid token exists, false if login initiated
   */
  async checkTokenAndPromptLogin() {
    // Check network status first - no point prompting for login if offline
    const isOnline = await checkNetworkStatus();
    if (!isOnline) {
      throw new Error('Cannot sync while offline. Connect to the internet and try again.');
    }

    const token = getToken();
    if (!token) {
      const shouldLogin = await this.showLoginPrompt();
      if (!shouldLogin) {
        throw new Error('Authentication required but user declined to login');
      }
      return false; // Login initiated, don't continue sync
    }
    
    // Actually validate the token against the server
    const isValid = await validateToken();
    if (!isValid) {
      const shouldLogin = await this.showLoginPrompt();
      if (!shouldLogin) {
        throw new Error('Authentication required but user declined to login');
      }
      return false; // Login initiated, don't continue sync
    }
    
    return true; // Token is valid, continue sync
  }

  // Handle 401/403 errors by prompting for login
  /**
   * Handles authentication errors by prompting user for login.
   * @param {Error} error - The error object containing status and message information
   * @returns {Promise<boolean>} Promise resolving to false if login initiated, throws otherwise
   */
  async handleAuthError(error) {
    if (error.status === 401 || error.status === 403 || 
        error.message.includes('Invalid access token') || 
        error.message.includes('Token expired') ||
        error.message.includes('Unauthorized')) {
      
      const shouldLogin = await this.showLoginPrompt();
      if (!shouldLogin) {
        throw new Error('Authentication failed and user declined to login');
      }
      return false; // Login initiated, don't continue sync
    }
    throw error; // Re-throw other errors
  }

  // Wrapper method to handle auth errors consistently
  /**
   * Wraps operations with consistent authentication error handling.
   * @param {Function} operation - The async operation to execute
   * @param {object} options - Options for error handling behavior
   * @returns {Promise<*>} Promise resolving to operation result or undefined on auth error
   */
  async withAuthErrorHandling(operation, options = {}) {
    const { continueOnError = false, contextMessage = '' } = options;
    
    try {
      return await operation();
    } catch (error) {
      console.error(`${contextMessage}:`, error);
      
      try {
        const handled = await this.handleAuthError(error);
        if (!handled) {
          return; // Login was initiated
        }
      } catch (authError) {
        if (continueOnError) {
          console.warn(`Auth error${contextMessage ? ` for ${contextMessage}` : ''}, continuing: ${authError.message}`);
          return;
        }
        throw authError;
      }
      
      // Re-throw the original error for non-auth errors
      throw error;
    }
  }

  // Sync all data (legacy method - calls new three-stage approach)
  /**
   * Syncs all data using the three-stage approach (legacy method).
   * @returns {Promise<void>} Promise that resolves when sync is complete
   */
  async syncAll() {
    await this.syncDashboardData();
    // Start background sync after dashboard data is complete
    setTimeout(() => this.syncBackgroundData(), 100);
  }

  // Stage 1: Sync core data only (fast)
  /**
   * Syncs core dashboard data including terms, sections, and FlexiRecord structures.
   * @returns {Promise<void>} Promise that resolves when core data sync is complete
   */
  async syncDashboardData() {
    if (this.isSyncing) {
      return;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({ status: 'syncing', message: 'Loading core data...' });

      const online = await this.isOnline();
      if (!online) {
        throw new Error('No internet connection available');
      }

      // Check token and prompt for login if needed
      const hasValidToken = await this.checkTokenAndPromptLogin();
      if (!hasValidToken) {
        this.notifyListeners({ 
          status: 'error', 
          message: 'Login required - redirecting to authentication',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const token = getToken();

      // Load core static data - events will be loaded by buildEventCards
      await this.syncTerms(token);
      await this.syncSections(token);
      
      // Get sections for FlexiRecord preloading
      const sections = await databaseService.getSections();
      
      // Preload static FlexiRecord data (lists and structures) - static like terms
      try {
        await this.withAuthErrorHandling(async () => {
          this.notifyListeners({ status: 'syncing', message: 'Loading FlexiRecord structures...' });
          await this.preloadStaticFlexiRecordData(sections, token);
        }, { 
          continueOnError: true,
          contextMessage: 'Failed to preload FlexiRecord static data',
        });
      } catch (error) {
        logger.warn('FlexiRecord static preloading failed', { error: error.message }, LOG_CATEGORIES.SYNC);
      }

      const completionTimestamp = Date.now();
      localStorage.setItem('viking_last_sync', completionTimestamp.toString());
      
      // Notify dashboard data is complete
      this.notifyListeners({ 
        status: 'dashboard_complete', 
        message: 'Core data loaded - events loading...',
        timestamp: completionTimestamp,
      });

    } catch (error) {
      logger.error('Core data sync failed', { error: error.message }, LOG_CATEGORIES.SYNC);
      
      try {
        const handled = await this.handleAuthError(error);
        if (!handled) return;
      } catch (authError) {
        this.notifyListeners({ 
          status: 'error', 
          message: authError.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.notifyListeners({ 
        status: 'error', 
        message: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Stage 2: Sync background data (members only) - non-blocking
  /**
   * Syncs background data including member information for all sections.
   * @returns {Promise<void>} Promise that resolves when background sync is complete
   */
  async syncBackgroundData() {
    try {
      this.notifyListeners({ status: 'syncing', message: 'Loading member data...' });

      const token = getToken();
      if (!token) return;

      const sections = await databaseService.getSections();
      
      // Sync members for all sections
      for (const section of sections) {
        await this.syncMembers(section.sectionid, token);
      }

      this.notifyListeners({ 
        status: 'background_complete', 
        message: 'Member data loaded',
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.warn('Background sync failed', { error: error.message }, LOG_CATEGORIES.SYNC);
      this.notifyListeners({ 
        status: 'background_error', 
        message: `Background sync failed: ${error.message}`,
        timestamp: Date.now(),
      });
    }
  }

  // Sync terms (core data needed for all section operations)
  /**
   * Syncs term data for all sections from OSM API.
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when terms are synced
   */
  async syncTerms(token) {
    try {
      await this.withAuthErrorHandling(async () => {
        this.notifyListeners({ status: 'syncing', message: 'Loading terms...' });
        
        // Load terms once for all sections - major optimization!
        await getTerms(token);
        // Terms loaded and cached successfully
      }, { 
        continueOnError: false,
        contextMessage: 'Failed to sync terms',
      });
    } catch (error) {
      // Only non-auth errors reach here (auth errors are handled in wrapper)
      throw new Error(`Failed to sync terms: ${error.message}`);
    }
  }

  // Sync sections
  /**
   * Syncs section data and user roles from OSM API.
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when sections are synced
   */
  async syncSections(token) {
    try {
      await this.withAuthErrorHandling(async () => {
        this.notifyListeners({ status: 'syncing', message: 'Syncing sections...' });
        
        // This will fetch from server and save to database
        await getUserRoles(token);
      }, { 
        continueOnError: false,
        contextMessage: 'Failed to sync sections',
      });
    } catch (error) {
      // Only non-auth errors reach here (auth errors are handled in wrapper)
      throw new Error(`Failed to sync sections: ${error.message}`);
    }
  }

  // Sync events for a section
  /**
   * Syncs events for a specific section from OSM API.
   * @param {string|number} sectionId - Section identifier
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when events are synced
   */
  async syncEvents(sectionId, token) {
    await this.withAuthErrorHandling(async () => {
      this.notifyListeners({ status: 'syncing', message: `Syncing events for section ${sectionId}...` });
      
      // Get the most recent term
      const termId = await fetchMostRecentTermId(sectionId, token);
      if (!termId) {
        logger.info(`No term found for section ${sectionId} - skipping events sync (this is normal for waiting lists)`, {
          sectionId,
        }, LOG_CATEGORIES.SYNC);
        return;
      }

      // This will fetch from server and save to database
      await getEvents(sectionId, termId, token);
    }, { 
      continueOnError: true,
      contextMessage: `Failed to sync events for section ${sectionId}`,
    });
  }

  // Sync attendance for an event
  /**
   * Syncs attendance data for a specific event from OSM API.
   * @param {string|number} sectionId - Section identifier
   * @param {string} eventId - Event identifier
   * @param {string} termId - Term identifier
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when attendance is synced
   */
  async syncAttendance(sectionId, eventId, termId, token) {
    await this.withAuthErrorHandling(async () => {
      this.notifyListeners({ status: 'syncing', message: `Syncing attendance for event ${eventId}...` });
      
      if (!termId) {
        // Try to get term ID if not provided
        termId = await fetchMostRecentTermId(sectionId, token);
      }

      if (!termId) {
        logger.info(`No term ID available for event ${eventId} in section ${sectionId} - skipping attendance sync (this is normal for waiting lists)`, {
          sectionId,
          eventId,
        }, LOG_CATEGORIES.SYNC);
        return;
      }

      // This will fetch from server and save to database
      await getEventAttendance(sectionId, eventId, termId, token);
    }, { 
      continueOnError: true,
      contextMessage: `Failed to sync attendance for event ${eventId}`,
    });
  }

  // Sync members data for a section (includes medical information)
  /**
   * Syncs member data including medical information for a specific section.
   * @param {string|number} sectionId - Section identifier
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when members are synced
   */
  async syncMembers(sectionId, token) {
    await this.withAuthErrorHandling(async () => {
      this.notifyListeners({ status: 'syncing', message: `Syncing members for section ${sectionId}...` });
      
      // Get the most recent term for this section
      const termId = await fetchMostRecentTermId(sectionId, token);
      if (!termId) {
        logger.info(`No term found for section ${sectionId} - skipping members sync (this is normal for waiting lists)`, {
          sectionId,
        }, LOG_CATEGORIES.SYNC);
        return;
      }

      // This will fetch from server and save to database (includes medical info)
      await getMembersGrid(sectionId, termId, token);
      
      logger.info('Members data synced successfully', {
        sectionId,
        termId,
      }, LOG_CATEGORIES.SYNC);
    }, { 
      continueOnError: true,
      contextMessage: `Failed to sync members for section ${sectionId}`,
    });
  }


  // Get sync status
  /**
   * Gets current synchronization status including offline data and connectivity.
   * @returns {Promise<object>} Promise resolving to sync status object
   */
  async getSyncStatus() {
    try {
      const hasOfflineData = await databaseService.hasOfflineData();
      const online = await this.isOnline();
      
      return {
        hasOfflineData,
        online,
        syncing: this.isSyncing,
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasOfflineData: false,
        online: false,
        syncing: false,
      };
    }
  }

  // Preload static flexirecord data (lists and structures) for faster access later
  /**
   * Preloads static FlexiRecord data including lists and structures for faster access.
   * @param {Array} sections - Array of section objects to preload data for
   * @param {string} token - Authentication token for API access
   * @returns {Promise<void>} Promise that resolves when preloading is complete
   */
  async preloadStaticFlexiRecordData(sections, token) {
    try {
      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        logger.info('No sections provided for flexirecord preloading', {}, LOG_CATEGORIES.SYNC);
        return;
      }

      logger.info('Preloading flexirecord structures', {
        sectionCount: sections.length,
      }, LOG_CATEGORIES.SYNC);
      
      // Import the API function here to avoid circular dependency
      const { getFlexiRecords, getFlexiStructure } = await import('../api/api.js');
      
      // Load flexirecord lists for all sections first
      const flexiRecordPromises = sections.map(async (section) => {
        try {
          const flexiRecords = await getFlexiRecords(section.sectionid, token, 'n', false);
          return { sectionId: section.sectionid, flexiRecords, success: true };
        } catch (error) {
          logger.warn('Failed to preload flexirecords for section', {
            sectionId: section.sectionid,
            error: error.message,
          }, LOG_CATEGORIES.SYNC);
          return { sectionId: section.sectionid, flexiRecords: null, success: false };
        }
      });

      const flexiRecordResults = await Promise.all(flexiRecordPromises);
      const successfulSections = flexiRecordResults.filter(r => r.success);
      
      logger.info('Loaded flexirecord lists', {
        successful: successfulSections.length,
        total: sections.length,
      }, LOG_CATEGORIES.SYNC);


      // Now load structures for all unique flexirecords found
      const allFlexiRecords = new Map();
      
      successfulSections.forEach(({ sectionId, flexiRecords }) => {
        if (flexiRecords && flexiRecords.items) {
          flexiRecords.items.forEach(record => {
            if (record.extraid && record.name && record.archived !== '1' && record.soft_deleted !== '1') {
              if (!allFlexiRecords.has(record.extraid)) {
                allFlexiRecords.set(record.extraid, {
                  extraid: record.extraid,
                  name: record.name,
                  sectionIds: [],
                });
              }
              allFlexiRecords.get(record.extraid).sectionIds.push(sectionId);
            }
          });
        }
      });

      if (allFlexiRecords.size === 0) {
        logger.info('No flexirecords found to preload structures for', {}, LOG_CATEGORIES.SYNC);
        return;
      }

      logger.info('Preloading structures for unique flexirecords', {
        count: allFlexiRecords.size,
      }, LOG_CATEGORIES.SYNC);

      // Load structures in parallel - only for "Viking Event Mgmt" and "Viking Section Movers" records
      const vikingRecords = Array.from(allFlexiRecords.values()).filter(record => 
        record.name === 'Viking Event Mgmt' || record.name === 'Viking Section Movers',
      );
      
      logger.info('Loading structures for Viking flexirecords', {
        totalRecords: allFlexiRecords.size,
        vikingEventMgmt: vikingRecords.filter(r => r.name === 'Viking Event Mgmt').length,
        vikingSectionMovers: vikingRecords.filter(r => r.name === 'Viking Section Movers').length,
      }, LOG_CATEGORIES.SYNC);
      
      const structurePromises = vikingRecords.map(async (record) => {
        try {
          // Use first section ID for the request
          const sectionId = record.sectionIds[0];
          await getFlexiStructure(record.extraid, sectionId, null, token);
          return { success: true, record };
        } catch (error) {
          logger.warn('Failed to preload structure for Viking flexirecord', {
            recordName: record.name,
            extraid: record.extraid,
            error: error.message,
          }, LOG_CATEGORIES.SYNC);
          return { success: false, record };
        }
      });

      const structureResults = await Promise.all(structurePromises);
      const successfulStructures = structureResults.filter(r => r.success);

      logger.info('Preloaded flexirecord structures', {
        successful: successfulStructures.length,
        total: allFlexiRecords.size,
      }, LOG_CATEGORIES.SYNC);

    } catch (error) {
      logger.error('Error preloading flexirecord structures', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.SYNC);
      throw error;
    }
  }

  // Auto-sync disabled - user must manually sync via dashboard
  /**
   * Sets up auto-sync functionality (currently disabled).
   * @returns {Promise<void>} Promise that resolves immediately
   */
  async setupAutoSync() {
    // Auto-sync functionality disabled to prevent unwanted OSM API calls
    // User must manually trigger sync via dashboard sync button
  }
}

export default new SyncService();
