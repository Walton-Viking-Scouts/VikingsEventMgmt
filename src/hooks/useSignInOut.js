import { useState, useRef, useEffect } from 'react';
import { fetchMostRecentTermId, updateFlexiRecord, getFlexiRecords } from '../services/api.js';
import { getFlexiRecordStructure } from '../services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { getToken, handleApiAuthError } from '../services/auth.js';
import { safeGetItem, safeGetSessionItem } from '../utils/storageUtils.js';
import { isDemoMode } from '../config/demoMode.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

// Inter-call delay to prevent API clashing - tunable for flaky APIs
const STEP_DELAY_MS = 150;

/**
 * Custom hook for handling sign-in/out functionality with memory leak prevention
 * 
 * @param {Array} events - Array of event data
 * @param {Function} onDataRefresh - Callback to refresh Viking Event data after operations
 * @returns {Object} Hook state and functions
 */
export function useSignInOut(events, onDataRefresh) {
  const [buttonLoading, setButtonLoading] = useState({});
  const abortControllerRef = useRef(null);

  // Initialize AbortController and cleanup on unmount to prevent memory leaks
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get current user info from cached startup data  
  const getCurrentUserInfo = () => {
    // First try sessionStorage user_info (set during auth)
    const userInfo = safeGetSessionItem('user_info', {});
    if (userInfo.firstname && userInfo.lastname) {
      return userInfo;
    }
    
    // Fallback to startup data in localStorage with demo mode awareness
    const demoMode = isDemoMode();
    const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
    const startupData = safeGetItem(cacheKey, {});
    // Prefer globals (where user info is actually stored) before falling back
    const fromGlobals = startupData?.globals
      ? { firstname: startupData.globals.firstname, lastname: startupData.globals.lastname }
      : null;
    return fromGlobals || { firstname: 'Unknown', lastname: 'User' };
  };

  // Helper to get field ID from field mapping
  const getFieldId = (fieldName, fieldMapping) => {
    for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
      if (fieldInfo.name === fieldName) {
        return fieldId;
      }
    }
    throw new Error(`Field '${fieldName}' not found in flexirecord structure`);
  };

  // Get Viking Event Mgmt flexirecord data for a section
  const getVikingEventFlexiRecord = async (sectionId, termId, token) => {
    const flexiRecords = await getFlexiRecords(sectionId, token);
    
    const vikingRecord = flexiRecords.items.find(record => 
      record.name && record.name.toLowerCase().includes('viking event'),
    );
    
    if (!vikingRecord) {
      throw new Error('Viking Event Mgmt flexirecord not found for this section');
    }
    
    const structure = await getFlexiRecordStructure(vikingRecord.extraid, sectionId, termId, token);
    
    return {
      extraid: vikingRecord.extraid,
      structure: structure,
      fieldMapping: parseFlexiStructure(structure),
    };
  };

  // Main sign in/out handler with memory leak prevention
  const handleSignInOut = async (member, action) => {
    // Freeze token for this operation to ensure consistency
    const opToken = getToken();
    
    try {
      // Check if component is still mounted before starting
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      // Set loading state for this specific button
      setButtonLoading(prev => ({ ...prev, [member.scoutid]: true }));
      
      // Get current user info from cached startup data
      const userInfo = getCurrentUserInfo();
      const currentUser = `${userInfo.firstname} ${userInfo.lastname}`;
      const timestamp = new Date().toISOString();
      
      // Get termId from events
      const event = events.find(e => e.sectionid === member.sectionid);
      const termId = event?.termid || await fetchMostRecentTermId(member.sectionid, opToken);
      
      if (!termId) {
        throw new Error('No term ID available - required for flexirecord updates');
      }
      
      // Get section type from cached section config
      const demoMode = isDemoMode();
      const sectionsKey = demoMode
        ? 'demo_viking_sections_offline'
        : 'viking_sections_offline';
      const cachedSections = safeGetItem(sectionsKey, []);
      const sectionConfig = cachedSections.find(section => section.sectionid === member.sectionid);
      const sectionType = sectionConfig?.sectiontype || 'beavers';
      
      // Get Viking Event Mgmt flexirecord structure for this section
      const vikingFlexiRecord = await getVikingEventFlexiRecord(member.sectionid, termId, opToken);
      
      // Check if component is still mounted after async operation
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (action === 'signin') {
        // Execute API calls sequentially with longer delays to prevent clashing
        const callNames = ['SignedInBy', 'SignedInWhen', 'Clear SignedOutBy', 'Clear SignedOutWhen'];
        
        try {
          // Step 1: Set SignedInBy
          logger.info(`Setting ${callNames[0]} for member`, {
            memberName: member.name || member.firstname,
            action: callNames[0],
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedInBy', vikingFlexiRecord.fieldMapping),
            currentUser,
            termId,
            sectionType,
            opToken,
          );
          logger.info(`${callNames[0]} completed successfully`, {
            memberName: member.name || member.firstname,
            action: callNames[0],
          }, LOG_CATEGORIES.API);
          
          // Delay to prevent clashing
          await new Promise(r => setTimeout(r, STEP_DELAY_MS));
          
          // Step 2: Set SignedInWhen
          logger.info(`Setting ${callNames[1]} for member`, {
            memberName: member.name || member.firstname,
            action: callNames[1],
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedInWhen', vikingFlexiRecord.fieldMapping),
            timestamp,
            termId,
            sectionType,
            opToken,
          );
          logger.info(`${callNames[1]} completed successfully`, {
            memberName: member.name || member.firstname,
            action: callNames[1],
          }, LOG_CATEGORIES.API);
          
          // Delay to prevent clashing
          await new Promise(r => setTimeout(r, STEP_DELAY_MS));
          
          // Step 3: Clear SignedOutBy
          logger.info(`${callNames[2]} for member`, {
            memberName: member.name || member.firstname,
            action: callNames[2],
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            opToken,
          );
          logger.info(`${callNames[2]} completed successfully`, {
            memberName: member.name || member.firstname,
            action: callNames[2],
          }, LOG_CATEGORIES.API);
          
          // Delay to prevent clashing
          await new Promise(r => setTimeout(r, STEP_DELAY_MS));
          
          // Step 4: Clear SignedOutWhen
          logger.info(`${callNames[3]} for member`, {
            memberName: member.name || member.firstname,
            action: callNames[3],
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            opToken,
          );
          logger.info(`${callNames[3]} completed successfully`, {
            memberName: member.name || member.firstname,
            action: callNames[3],
          }, LOG_CATEGORIES.API);
          
        } catch (callError) {
          logger.error('Sign-in operation failed', { 
            error: callError.message,
            memberName: member.name || member.firstname, 
          }, LOG_CATEGORIES.API);
          throw callError; // Re-throw to be handled by outer catch
        }
        
        // Check if component is still mounted after sign-in operations
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        // Member signed in successfully
      } else {
        // Execute sign-out API calls sequentially with longer delays to prevent clashing
        try {
          // Step 1: Set SignedOutBy
          logger.info('Setting SignedOutBy for member', {
            memberName: member.name || member.firstname,
            action: 'SignedOutBy',
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
            currentUser,
            termId,
            sectionType,
            opToken,
          );
          logger.info('SignedOutBy completed successfully', {
            memberName: member.name || member.firstname,
            action: 'SignedOutBy',
          }, LOG_CATEGORIES.API);
          
          // Delay to prevent clashing
          await new Promise(r => setTimeout(r, STEP_DELAY_MS));
          
          // Step 2: Set SignedOutWhen
          logger.info('Setting SignedOutWhen for member', {
            memberName: member.name || member.firstname,
            action: 'SignedOutWhen',
          }, LOG_CATEGORIES.API);
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
            timestamp,
            termId,
            sectionType,
            opToken,
          );
          logger.info('SignedOutWhen completed successfully', {
            memberName: member.name || member.firstname,
            action: 'SignedOutWhen',
          }, LOG_CATEGORIES.API);
          
        } catch (callError) {
          logger.error('Sign-out operation failed', { 
            error: callError.message,
            memberName: member.name || member.firstname, 
          }, LOG_CATEGORIES.API);
          throw callError; // Re-throw to be handled by outer catch
        }
        
        // Check if component is still mounted after sign-out operations
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        // Member signed out successfully
      }
      
      // Check if component is still mounted before refreshing data
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      // Refresh Viking Event data to show updates
      if (onDataRefresh) {
        await onDataRefresh();
      }
      
    } catch (error) {
      // Don't show errors if component was unmounted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      const memberLabel = member.name || member.firstname || String(member.scoutid);
      logger.error(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} member`, {
        member: { id: member.scoutid, label: memberLabel },
        action,
        error: error?.stack || error?.message || String(error),
      }, LOG_CATEGORIES.API);
      
      // Check if this is a token expiration error
      if (error.message?.includes('No authentication token')) {
        // Handle authentication failure to trigger auth state update
        const authResult = handleApiAuthError(error);
        
        if (authResult.offline) {
          // Token expired but we have cached data - user can still use app offline
          alert('Your session has expired. Please sign in again to refresh data from OSM, or continue using cached data offline.');
        } else {
          // No cached data available - user needs to log in
          alert('Your session has expired. Please sign in to OSM to continue.');
        }
        
        // Force a page reload to trigger auth state re-evaluation
        if (authResult.shouldReload) {
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      } else {
        // Regular error - show generic message
        alert(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${memberLabel}: ${error.message}`);
      }
      
    } finally {
      // Only clear loading state if component is still mounted
      if (!abortControllerRef.current?.signal.aborted) {
        setButtonLoading(prev => ({ ...prev, [member.scoutid]: false }));
      }
    }
  };

  return {
    buttonLoading,
    handleSignInOut,
  };
}