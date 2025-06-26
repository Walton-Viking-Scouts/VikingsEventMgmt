import databaseService from './database.js';
import { getUserRoles, getEvents, getEventAttendance, getMostRecentTermId } from './api.js';
import { getToken } from './auth.js';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
  }

  // Add listener for sync status changes
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  // Remove sync listener
  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
  }

  // Notify listeners of sync status
  notifyListeners(status) {
    this.syncListeners.forEach(callback => callback(status));
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

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

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
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners({ 
        status: 'error', 
        message: error.message,
        timestamp: new Date().toISOString()
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
        syncing: this.isSyncing
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasOfflineData: false,
        online: false,
        syncing: false
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