import databaseService from './database.js';
import { getUserRoles, getEvents, getEventAttendance, getMostRecentTermId, getTerms } from './api.js';
import { getToken, validateToken, generateOAuthUrl } from './auth.js';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

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
      
      // Sync events for each section
      for (const section of sections) {
        await this.syncEvents(section.sectionid, token);
        
        // Sync attendance for each event in this section
        const events = await databaseService.getEvents(section.sectionid);
        for (const event of events) {
          await this.syncAttendance(section.sectionid, event.eventid, event.termid || null, token);
        }
      }

      this.notifyListeners({ 
        status: 'completed', 
        message: 'Sync completed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Sync failed:', error);
      
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
        const terms = await getTerms(token);
        const termCount = Object.keys(terms).length;
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
        const sections = await getUserRoles(token);
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
      const termId = await getMostRecentTermId(sectionId, token);
      if (!termId) {
        console.warn(`No term found for section ${sectionId}`);
        return;
      }

      // This will fetch from server and save to database
      const events = await getEvents(sectionId, termId, token);
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
        termId = await getMostRecentTermId(sectionId, token);
      }

      if (!termId) {
        console.warn(`No term ID available for event ${eventId} in section ${sectionId}`);
        return;
      }

      // This will fetch from server and save to database
      const attendance = await getEventAttendance(sectionId, eventId, termId, token);
    }, { 
      continueOnError: true,
      contextMessage: `Failed to sync attendance for event ${eventId}`,
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

  // Auto-sync disabled - user must manually sync via dashboard
  async setupAutoSync() {
    // Auto-sync functionality disabled to prevent unwanted OSM API calls
    // User must manually trigger sync via dashboard sync button
  }
}

export default new SyncService();
