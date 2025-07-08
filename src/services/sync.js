import databaseService from './database.js';
import { getUserRoles, getEvents, getEventAttendance, getMostRecentTermId } from './api.js';
import { getToken, isAuthenticated, generateOAuthUrl } from './auth.js';
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
    if (!token || !isAuthenticated()) {
      console.log('No valid token found - prompting for login');
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
      
      console.log('Authentication error detected - prompting for login');
      const shouldLogin = await this.showLoginPrompt();
      if (!shouldLogin) {
        throw new Error('Authentication failed and user declined to login');
      }
      return false; // Login initiated, don't continue sync
    }
    throw error; // Re-throw other errors
  }

  // Sync all data
  async syncAll() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
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

      // Sync sections first
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

  // Sync sections
  async syncSections(token) {
    try {
      this.notifyListeners({ status: 'syncing', message: 'Syncing sections...' });
      
      // This will fetch from server and save to database
      const sections = await getUserRoles(token);
      console.log(`Synced ${sections.length} sections`);
      
    } catch (error) {
      console.error('Failed to sync sections:', error);
      
      // Check if it's an auth error
      const handled = await this.handleAuthError(error);
      if (!handled) {
        return; // Login was initiated
      }
      
      throw new Error(`Failed to sync sections: ${error.message}`);
    }
  }

  // Sync events for a section
  async syncEvents(sectionId, token) {
    try {
      this.notifyListeners({ status: 'syncing', message: `Syncing events for section ${sectionId}...` });
      
      // Get the most recent term
      const termId = await getMostRecentTermId(sectionId, token);
      if (!termId) {
        console.warn(`No term found for section ${sectionId}`);
        return;
      }

      // This will fetch from server and save to database
      const events = await getEvents(sectionId, termId, token);
      console.log(`Synced ${events.length} events for section ${sectionId}`);
      
    } catch (error) {
      console.error(`Failed to sync events for section ${sectionId}:`, error);
      
      // Check if it's an auth error
      try {
        const handled = await this.handleAuthError(error);
        if (!handled) {
          return; // Login was initiated
        }
      } catch (authError) {
        // Auth error handled, continue with other sections
        console.warn(`Auth error for section ${sectionId}, continuing with other sections`);
        return;
      }
      
      // Don't throw here - continue with other sections
    }
  }

  // Sync attendance for an event
  async syncAttendance(sectionId, eventId, termId, token) {
    try {
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
      console.log(`Synced ${attendance.length} attendance records for event ${eventId}`);
      
    } catch (error) {
      console.error(`Failed to sync attendance for event ${eventId}:`, error);
      
      // Check if it's an auth error
      try {
        const handled = await this.handleAuthError(error);
        if (!handled) {
          return; // Login was initiated
        }
      } catch (authError) {
        // Auth error handled, continue with other events
        console.warn(`Auth error for event ${eventId}, continuing with other events`);
        return;
      }
      
      // Don't throw here - continue with other events
    }
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

  // Auto-sync when coming back online
  async setupAutoSync() {
    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', async (status) => {
        if (status.connected && !this.isSyncing) {
          console.log('Network reconnected - starting auto-sync');
          try {
            await this.syncAll();
          } catch (error) {
            console.error('Auto-sync failed:', error);
          }
        }
      });
    } else {
      window.addEventListener('online', async () => {
        if (!this.isSyncing) {
          console.log('Network reconnected - starting auto-sync');
          try {
            await this.syncAll();
          } catch (error) {
            console.error('Auto-sync failed:', error);
          }
        }
      });
    }
  }
}

export default new SyncService();
