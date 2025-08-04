import { useState, useRef, useEffect } from 'react';
import { fetchMostRecentTermId, updateFlexiRecord, getFlexiRecords } from '../services/api.js';
import { getFlexiRecordStructure } from '../services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { getToken } from '../services/auth.js';
import { safeGetItem, safeGetSessionItem } from '../utils/storageUtils.js';

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
    
    // Fallback to startup data in localStorage
    const startupData = safeGetItem('viking_startup_data_offline', {});
    return startupData.user || { firstname: 'Unknown', lastname: 'User' };
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
  const getVikingEventFlexiRecord = async (sectionId, termId) => {
    const token = getToken();
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
      const termId = event?.termid || await fetchMostRecentTermId(member.sectionid, getToken());
      
      if (!termId) {
        throw new Error('No term ID available - required for flexirecord updates');
      }
      
      // Get section type from cached section config
      const cachedSections = safeGetItem('vikings_sections_offline', []);
      const sectionConfig = cachedSections.find(section => section.sectionid === member.sectionid);
      const sectionType = sectionConfig?.sectiontype || 'beavers';
      
      // Get Viking Event Mgmt flexirecord structure for this section
      const vikingFlexiRecord = await getVikingEventFlexiRecord(member.sectionid, termId);
      
      // Check if component is still mounted after async operation
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (action === 'signin') {
        // Sign in requires two API calls: SignedInBy and SignedInWhen
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedInBy', vikingFlexiRecord.fieldMapping),
          currentUser,
          termId,
          sectionType,
          getToken(),
        );
        
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedInWhen', vikingFlexiRecord.fieldMapping),
          timestamp,
          termId,
          sectionType,
          getToken(),
        );
        
        // Clear signed out fields if they have values (only make API calls if needed)
        const hasSignedOutBy = member.vikingEventData?.SignedOutBy && 
                               member.vikingEventData.SignedOutBy !== '-' && 
                               member.vikingEventData.SignedOutBy.trim() !== '';
        const hasSignedOutWhen = member.vikingEventData?.SignedOutWhen && 
                                 member.vikingEventData.SignedOutWhen !== '-' && 
                                 member.vikingEventData.SignedOutWhen.trim() !== '';
        
        if (hasSignedOutBy) {
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            getToken(),
          );
        }
        
        if (hasSignedOutWhen) {
          await updateFlexiRecord(
            member.sectionid,
            member.scoutid,
            vikingFlexiRecord.extraid,
            getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
            '', // Clear the field
            termId,
            sectionType,
            getToken(),
          );
        }
        
        // Check if component is still mounted after sign-in operations
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        console.log(`Successfully signed in ${member.name}`);
      } else {
        // Sign out requires two API calls: SignedOutBy and SignedOutWhen
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping),
          currentUser,
          termId,
          sectionType,
          getToken(),
        );
        
        await updateFlexiRecord(
          member.sectionid,
          member.scoutid,
          vikingFlexiRecord.extraid,
          getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping),
          timestamp,
          termId,
          sectionType,
          getToken(),
        );
        
        // Check if component is still mounted after sign-out operations
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        console.log(`Successfully signed out ${member.name}`);
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
      
      console.error(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${member.name}:`, error);
      
      // TODO: Replace with proper toast notification system
      alert(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${member.name}: ${error.message}`);
      
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