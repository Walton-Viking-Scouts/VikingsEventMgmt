import databaseService from './database.js';
import { getUserRoles, getEvents, getEventAttendance, fetchMostRecentTermId, getTerms, getMembersGrid } from './api.js';
import { getToken, validateToken, generateOAuthUrl } from './auth.js';
import logger, { LOG_CATEGORIES } from './logger.js';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { checkNetworkStatus } from '../utils/networkUtils.js';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.loginPromptCallbacks = [];
  }

  // Add listener for sync status changes
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  // Remove sync listener
  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
  }

  // Add listener for login prompt requests
  addLoginPromptListener(callback) {
    this.loginPromptCallbacks.push(callback);
  }

  // Remove login prompt listener
  removeLoginPromptListener(callback) {
    this.loginPromptCallbacks = this.loginPromptCallbacks.filter(cb => cb !== callback);
  }

  // Notify listeners of sync status
  notifyListeners(status) {
    this.syncListeners.forEach(callback => callback(status));
  }

  // Notify listeners to show login prompt
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
  async isOnline() {
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      return status.connected;
    } else {
      return navigator.onLine;
    }
  }

  // Check if we have a valid token before syncing
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

  // Sync all data
  async syncAll() {
    if (this.isSyncing) {
      return;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({ status: 'syncing', message: 'Starting sync...' });

      const online = await this.isOnline();
      if (!online) {
        throw new Error('No internet connection available');
      }

      // Check token and prompt for login if needed
      const hasValidToken = await this.checkTokenAndPromptLogin();
      if (!hasValidToken) {
        // User was prompted for login, don't continue sync
        this.notifyListeners({ 
          status: 'error', 
          message: 'Login required - redirecting to authentication',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const token = getToken();

      // Load core data needed for all operations
      await this.syncTerms(token);  // Load terms once for all sections
      await this.syncSections(token);
      
      // Get sections from database to sync events and attendance
      const sections = await databaseService.getSections();
      
      // Sync events and members for each section FIRST (better UX - dashboard shows data faster)
      for (const section of sections) {
        await this.syncEvents(section.sectionid, token);
        
        // Sync members data (includes medical information and other member details)
        await this.syncMembers(section.sectionid, token);
        
        // Sync attendance only for events shown on dashboard (last week + future)
        const events = await databaseService.getEvents(section.sectionid);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        // Filter to dashboard-relevant events only (matches filterEventsByDateRange logic)
        const dashboardEvents = events.filter(event => {
          const eventDate = new Date(event.startdate);
          return eventDate >= oneWeekAgo; // Same logic as EventDashboard filter
        });
        
        logger.info('Syncing attendance for dashboard events only', {
          sectionId: section.sectionid,
          totalEvents: events.length,
          dashboardEvents: dashboardEvents.length,
        }, LOG_CATEGORIES.SYNC);
        
        for (const event of dashboardEvents) {
          await this.syncAttendance(section.sectionid, event.eventid, event.termid || null, token);
        }
      }

      // Preload static flexirecord data AFTER events (better UX - dashboard loads faster)
      // Dynamic data (actual member values) is loaded on-demand when "View Attendees" is clicked
      try {
        await this.withAuthErrorHandling(async () => {
          this.notifyListeners({ status: 'syncing', message: 'Preloading flexirecord data...' });
          await this.preloadStaticFlexiRecordData(sections, token);
        }, { 
          continueOnError: true, // Don't fail sync if flexirecord preloading fails
          contextMessage: 'Failed to preload flexirecord static data',
        });
      } catch (error) {
        logger.warn('FlexiRecord static data preloading failed, sync completed without it', {
          error: error.message,
        }, LOG_CATEGORIES.SYNC);
        // Continue with sync - this is optimization, not critical
      }

      const completionTimestamp = Date.now(); // Epoch milliseconds for UI compatibility
      
      // Store last sync time for UI display (convert to string for localStorage)
      localStorage.setItem('viking_last_sync', completionTimestamp.toString());
      
      this.notifyListeners({ 
        status: 'completed', 
        message: 'Sync completed successfully',
        timestamp: completionTimestamp,
      });

    } catch (error) {
      logger.error('Sync failed', {
        error: error.message,
        stack: error.stack,
      }, LOG_CATEGORIES.SYNC);
      
      // Check if it's an auth error and handle appropriately
      try {
        const handled = await this.handleAuthError(error);
        if (!handled) {
          // Login was initiated, don't show error
          return;
        }
      } catch (authError) {
        // Auth error was handled or user declined login
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

  // Sync terms (core data needed for all section operations)
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
      const { getFlexiRecords, getFlexiStructure } = await import('./api.js');
      
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

      // Load structures in parallel - only for "Viking Event Mgmt" records (optimization)
      const vikingEventRecords = Array.from(allFlexiRecords.values()).filter(record => 
        record.name === 'Viking Event Mgmt',
      );
      
      logger.info('Loading structures for "Viking Event Mgmt" flexirecords only', {
        totalRecords: allFlexiRecords.size,
        vikingEventRecords: vikingEventRecords.length,
      }, LOG_CATEGORIES.SYNC);
      
      const structurePromises = vikingEventRecords.map(async (record) => {
        try {
          // Use first section ID for the request
          const sectionId = record.sectionIds[0];
          await getFlexiStructure(record.extraid, sectionId, null, token);
          return { success: true, record };
        } catch (error) {
          logger.warn('Failed to preload structure for "Viking Event Mgmt" flexirecord', {
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
  async setupAutoSync() {
    // Auto-sync functionality disabled to prevent unwanted OSM API calls
    // User must manually trigger sync via dashboard sync button
  }
}

export default new SyncService();
