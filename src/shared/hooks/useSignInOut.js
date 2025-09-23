import { useState, useRef, useEffect } from 'react';
import { fetchMostRecentTermId, updateFlexiRecord } from '../services/api/api.js';
import { getFlexiRecordsList } from '../../features/events/services/flexiRecordService.js';
// TODO: Move getFlexiRecordStructure to shared layer to avoid circular dependency
// import { getFlexiRecordStructure } from '../../features/events/services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { getToken } from '../services/auth/tokenService.js';
import { safeGetSessionItem } from '../utils/storageUtils.js';
import { isDemoMode } from '../../config/demoMode.js';
import UnifiedStorageService from '../services/storage/unifiedStorageService.js';
import IndexedDBService from '../services/storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { CLEAR_STRING_SENTINEL, CLEAR_TIME_SENTINEL } from '../constants/signInDataConstants.js';

// Inter-call delay to prevent API clashing - tunable for flaky APIs
const STEP_DELAY_MS = 150;

/**
 * Custom hook for handling sign-in/out functionality with memory leak prevention
 * 
 * @param {Array} events - Array of event data
 * @param {Function} onDataRefresh - Callback to refresh Viking Event data after operations
 * @param {Object} notificationHandlers - Optional notification handlers from toast utilities
 * @param {Function} notificationHandlers.notifyError - Function to display error notifications
 * @param {Function} notificationHandlers.notifyWarning - Function to display warning notifications
 * @returns {Object} Hook state and functions
 */
export function useSignInOut(events, onDataRefresh, notificationHandlers = {}) {
  const [buttonLoading, setButtonLoading] = useState({});
  const abortControllerRef = useRef(null);
  const { notifyError, notifyWarning } = notificationHandlers;

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
  const getCurrentUserInfo = async () => {
    // First try sessionStorage user_info (set during auth)
    const userInfo = safeGetSessionItem('user_info', {});
    if (userInfo.firstname && userInfo.lastname) {
      return userInfo;
    }

    // Fallback to startup data using unified storage service (IndexedDB or localStorage)
    const demoMode = isDemoMode();
    const cacheKey = demoMode ? 'demo_viking_startup_data_offline' : 'viking_startup_data_offline';
    const startupData = await UnifiedStorageService.get(cacheKey) || {};
    // Prefer globals (where user info is actually stored) before falling back
    const fromGlobals = startupData?.globals
      ? { firstname: startupData.globals.firstname, lastname: startupData.globals.lastname }
      : null;
    return fromGlobals || { firstname: 'Unknown', lastname: 'User' };
  };

  // Helper to get field ID from field mapping (handles both Map and object formats)
  const getFieldId = (fieldName, fieldMapping) => {
    const targetName = fieldName.toLowerCase();

    // Handle Map format (parseFlexiStructure returns a Map)
    if (fieldMapping instanceof Map) {
      for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
        if (fieldInfo.name && fieldInfo.name.toLowerCase() === targetName) {
          return fieldId;
        }
      }
    }
    // Handle object format (cached structure might be an object)
    else if (fieldMapping && typeof fieldMapping === 'object') {
      for (const [fieldId, fieldInfo] of Object.entries(fieldMapping)) {
        if (fieldInfo.name && fieldInfo.name.toLowerCase() === targetName) {
          return fieldId;
        }
      }
    }

    // Log available field names for debugging
    const availableFields = [];
    if (fieldMapping instanceof Map) {
      for (const [fieldId, fieldInfo] of fieldMapping.entries()) {
        availableFields.push(fieldInfo.name || fieldId);
      }
    } else if (fieldMapping && typeof fieldMapping === 'object') {
      for (const [fieldId, fieldInfo] of Object.entries(fieldMapping)) {
        availableFields.push(fieldInfo.name || fieldId);
      }
    }

    logger.error(`Field '${fieldName}' not found in flexirecord structure`, {
      requestedField: fieldName,
      availableFields,
      fieldMappingType: typeof fieldMapping,
    }, LOG_CATEGORIES.ERROR);

    throw new Error(`Field '${fieldName}' not found in flexirecord structure. Available fields: ${availableFields.join(', ')}`);
  };

  // Get Viking Event Mgmt flexirecord data for a section
  const getVikingEventFlexiRecord = async (sectionId, termId, token) => {
    try {
      // Get all FlexiRecord structures from IndexedDB
      const structureKeys = await IndexedDBService.getAllKeys('flexi_structure');
      const structures = [];
      for (const key of structureKeys) {
        const data = await IndexedDBService.get('flexi_structure', key);
        if (data) {
          structures.push({ key, value: data.data });
        }
      }

      // Get FlexiRecord data for this section from IndexedDB
      const dataKeys = await IndexedDBService.getAllKeys('flexi_data');
      const sectionData = [];
      for (const key of dataKeys) {
        if (key.includes(`_${sectionId}_`)) {
          const data = await IndexedDBService.get('flexi_data', key);
          if (data) {
            sectionData.push({ key, value: data.data });
          }
        }
      }

      // Found IndexedDB data for FlexiRecord lookup

      if (structures.length > 0 && sectionData.length > 0) {
        // Extract FlexiRecord ID from the section data key
        const dataItem = sectionData[0];
        const keyParts = dataItem.key.replace('viking_flexi_data_', '').replace('_offline', '').split('_');
        const realFlexiRecordId = keyParts[0];

        // Extract FlexiRecord ID from section data key

        // Find a structure that matches this FlexiRecord ID
        for (const structureItem of structures) {
          try {
            const structureData = structureItem.value;

            // Examining structure for FlexiRecord ID match

            // Check if this structure matches the FlexiRecord ID from the data
            const structureFlexiRecordId = structureData?.extraid || structureData?._structure?.extraid ||
                                         structureData?.flexirecordid || structureData?._structure?.flexirecordid;
            if (String(structureFlexiRecordId) !== String(realFlexiRecordId)) {
              // Structure FlexiRecord ID mismatch, skipping
              continue;
            }

            // Look for SignedOutBy and SignedInBy fields (case insensitive)
            // Extract field mapping from structure.rows (IndexedDB format) or fallback to old format
            let fieldMapping = structureData?.vikingFlexiRecord?.fieldMapping || structureData?._structure?.vikingFlexiRecord?.fieldMapping;

            // If no direct fieldMapping, extract from structure.rows (IndexedDB format)
            if (!fieldMapping && structureData?._structure?.rows) {
              fieldMapping = {};
              structureData._structure.rows.forEach((row, index) => {
                if (row.name && row.field) {
                  fieldMapping[row.field] = {
                    name: row.name,
                    field: row.field,
                    index: index,
                  };
                }
              });
            }

            fieldMapping = fieldMapping || {};
            const hasSignInOutFields = Object.values(fieldMapping).some(field => {
              const name = field.name?.toLowerCase();
              return name === 'signedoutby' || name === 'signed out by' ||
                     name === 'signedinby' || name === 'signed in by';
            });

            if (hasSignInOutFields) {
              // Found Viking Event structure with sign-in/out fields

              return {
                extraid: realFlexiRecordId,
                structure: structureData,
                fieldMapping: structureData?.vikingFlexiRecord?.fieldMapping || structureData?._structure?.vikingFlexiRecord?.fieldMapping,
              };
            } else {
              // Structure missing required sign-in/out fields
            }
          } catch (error) {
            console.warn('Failed to parse Viking Event structure:', structureItem.key, error);
          }
        }
      }

      // No suitable Viking Event structure found in cache

    } catch (error) {
      console.warn('Failed to load Viking Event data from cache:', error);
    }

    // Fallback to Viking Event FlexiRecords approach (same as camp groups)
    const flexiRecords = await getFlexiRecordsList(sectionId, token);

    const vikingRecord = flexiRecords.items.find(record =>
      record.name && record.name.toLowerCase().includes('viking event'),
    );

    if (!vikingRecord) {
      throw new Error('Viking Event Mgmt flexirecord not found for this section');
    }

    // Found Viking Event flexirecord from API

    // Try to fetch and cache the structure for this FlexiRecord
    try {
      const { getFlexiRecordStructure } = await import('../../features/events/services/flexiRecordService.js');

      // Fetch structure for FlexiRecord ID
      const structure = await getFlexiRecordStructure(vikingRecord.extraid, token, termId);

      if (structure) {
        // Successfully fetched FlexiRecord structure

        // Use the same parsing logic that works for Camp Group display
        let fieldMapping = null;

        // Always parse the structure using parseFlexiStructure() like the working Camp Group code path
        try {
          fieldMapping = parseFlexiStructure(structure);
        } catch (parseError) {
          logger.error('Failed to parse FlexiRecord structure with parseFlexiStructure()', { error: parseError.message }, LOG_CATEGORIES.ERROR);

          // Fallback: try to access pre-parsed data (though this usually doesn't exist)
          if (structure?.vikingFlexiRecord?.fieldMapping) {
            fieldMapping = structure.vikingFlexiRecord.fieldMapping;
          } else if (structure?._structure?.vikingFlexiRecord?.fieldMapping) {
            fieldMapping = structure._structure.vikingFlexiRecord.fieldMapping;
          }
        }

        if (fieldMapping && fieldMapping.size > 0) {
        }

        return {
          extraid: vikingRecord.extraid,
          structure,
          fieldMapping,
        };
      }
    } catch (structureError) {
      console.error('🐛 Sign-in/out: Failed to fetch FlexiRecord structure:', structureError);
    }

    // Final fallback - structure fetching failed
    throw new Error('FlexiRecord structure not available - failed to fetch structure for FlexiRecord ID: ' + vikingRecord.extraid);
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
      const userInfo = await getCurrentUserInfo();
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
      const cachedSections = await UnifiedStorageService.get(sectionsKey) || [];
      const sectionConfig = cachedSections.find(section => section.sectionid === member.sectionid);
      const sectionType = sectionConfig?.sectiontype || 'beavers';
      
      // Get Viking Event Mgmt flexirecord structure for this section
      const vikingFlexiRecord = await getVikingEventFlexiRecord(member.sectionid, termId, opToken);

      // Check if component is still mounted after async operation
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Using FlexiRecord for sign-in/out operations

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
            CLEAR_STRING_SENTINEL,
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
            CLEAR_TIME_SENTINEL,
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
        // TODO: Move handleApiAuthError to shared layer
        const authResult = { offline: false, shouldReload: false }; // Temporary mock
        
        if (authResult.offline) {
          // Token expired but we have cached data - user can still use app offline
          if (notifyWarning) {
            notifyWarning('Your session has expired. Please sign in again to refresh data from OSM, or continue using cached data offline.');
          } else {
            console.warn('Session expired with offline mode available');
          }
        } else {
          // No cached data available - user needs to log in
          if (notifyError) {
            notifyError('Your session has expired. Please sign in to OSM to continue.');
          } else {
            console.error('Session expired without cached data');
          }
        }
        
        // Force a page reload to trigger auth state re-evaluation
        if (authResult.shouldReload) {
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      } else {
        // Regular error - show generic message
        if (notifyError) {
          notifyError(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${memberLabel}: ${error.message}`);
        } else {
          console.error(`Sign in/out failed: ${error.message}`);
        }
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
    getVikingEventFlexiRecord,
  };
}