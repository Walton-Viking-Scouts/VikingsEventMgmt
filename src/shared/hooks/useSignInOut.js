import { useState, useRef, useEffect } from 'react';
import { fetchMostRecentTermId, updateFlexiRecord } from '../services/api/api.js';
import { getFlexiRecordsList } from '../../features/events/services/flexiRecordService.js';
// TODO: Move getFlexiRecordStructure to shared layer to avoid circular dependency
// import { getFlexiRecordStructure } from '../../features/events/services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { getToken } from '../services/auth/tokenService.js';
import { safeGetItem, safeGetSessionItem } from '../utils/storageUtils.js';
import { isDemoMode } from '../../config/demoMode.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

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
    // Use the same fallback mechanism as camp groups - check localStorage directly
    try {
      const structureKeys = Object.keys(localStorage).filter(key => 
        key.includes('viking_flexi_structure_') && key.includes('offline'),
      );
      
      const dataKeys = Object.keys(localStorage).filter(key => 
        key.includes('viking_flexi_data_') && key.includes(`_${sectionId}_`) && key.includes('offline'),
      );
      
      console.log('🐛 Sign-in/out: Found cache keys:', {
        structureKeys,
        dataKeys,
        sectionId,
      });

      if (structureKeys.length > 0 && dataKeys.length > 0) {
        // Also check the data to see what FlexiRecord ID matches
        const dataKey = dataKeys[0];
        const keyParts = dataKey.replace('viking_flexi_data_', '').replace('_offline', '').split('_');
        const realFlexiRecordId = keyParts[0];
        
        console.log('🐛 Sign-in/out: Data key analysis:', {
          dataKey,
          realFlexiRecordId,
          keyParts,
        });
        
        // Try to find a structure that matches this FlexiRecord ID
        for (const structureKey of structureKeys) {
          try {
            const structureData = JSON.parse(localStorage.getItem(structureKey));
            
            console.log('🐛 Sign-in/out: Examining structure:', {
              structureKey,
              structureFlexiRecordId: structureData?.flexirecordid || structureData?._structure?.flexirecordid,
              structureExtraid: structureData?.extraid || structureData?._structure?.extraid,
              expectedFlexiRecordId: realFlexiRecordId,
              hasFieldMapping: !!structureData?.fieldMapping,
              hasStructureFieldMapping: !!structureData?._structure?.fieldMapping,
              actualStructure: structureData, // Show the full structure for debugging
            });
            
            // Check if this structure matches the FlexiRecord ID from the data
            // In OSM API, flexirecordid is stored as extraid
            const structureFlexiRecordId = structureData?.extraid || structureData?._structure?.extraid || 
                                         structureData?.flexirecordid || structureData?._structure?.flexirecordid;
            if (String(structureFlexiRecordId) !== String(realFlexiRecordId)) {
              console.log('🐛 Sign-in/out: Structure FlexiRecord ID mismatch, skipping');
              continue;
            }
            
            // Parse the raw structure to get field mapping (same as flexiRecordService does)
            const fieldMapping = {};
            try {
              const parsedMapping = parseFlexiStructure(structureData);
              if (parsedMapping && parsedMapping.size > 0) {
                // Convert fieldMapping Map to object (same format as flexiRecordService)
                parsedMapping.forEach((fieldInfo, fieldId) => {
                  fieldMapping[fieldId] = {
                    columnId: fieldId,
                    ...fieldInfo,
                  };
                });
                console.log('🐛 Sign-in/out: Parsed structure:', {
                  structureKey,
                  parsedFieldCount: parsedMapping.size,
                });
              }
            } catch (error) {
              console.log('🐛 Sign-in/out: Failed to parse structure:', error);
            }
            
            const fieldNames = Object.values(fieldMapping).map(f => f?.name).filter(Boolean);
            
            console.log('🐛 Sign-in/out: Structure field analysis:', {
              structureKey,
              fieldMapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : 'empty',
              fieldNames,
              rawStructureKeys: Object.keys(structureData || {}),
              hasStructureProperty: !!structureData?._structure,
              structureColumns: structureData?.structure?.cols || structureData?.cols || 'none',
            });
            
            // Look for SignedOutBy field (case insensitive)
            const hasSignedOutByField = Object.values(fieldMapping).some(field => {
              const name = field.name?.toLowerCase();
              return name === 'signedoutby' || name === 'signed out by';
            });
            
            if (hasSignedOutByField) {
              console.log('🐛 Sign-in/out: Found Viking Event structure with SignedOutBy field:', {
                structureKey,
                realFlexiRecordId,
                fieldNames,
              });
              
              return {
                extraid: realFlexiRecordId,
                structure: structureData,
                fieldMapping: parseFlexiStructure(structureData._structure || structureData),
              };
            } else {
              console.log('🐛 Sign-in/out: Structure missing SignedOutBy field:', {
                structureKey,
                fieldNames,
              });
            }
          } catch (error) {
            console.warn('Failed to parse Viking Event structure:', structureKey, error);
          }
        }
      }
      
      console.log('🐛 Sign-in/out: No suitable Viking Event structure found in cache', {
        structureKeys: structureKeys.length,
        dataKeys: dataKeys.length,
        sectionId,
      });
      
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
    
    console.log('🐛 Sign-in/out: Found Viking Event flexirecord from API:', {
      extraid: vikingRecord.extraid,
      name: vikingRecord.name,
    });
    
    // The TODO is that we need to get the structure for this flexirecord
    // For now, this will cause the "Field 'SignedOutBy' not found" error
    // because we don't have the structure to parse the field mapping
    throw new Error('FlexiRecord structure not available - need to implement structure fetching for FlexiRecord ID: ' + vikingRecord.extraid);
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
            '---', // Clear the field
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
            '', // Clear the time field with empty string
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
  };
}