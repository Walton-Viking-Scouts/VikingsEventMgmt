import { useState, useRef, useEffect } from 'react';
import { fetchMostRecentTermId } from '../services/api/api/terms.js';
import signInOutbox from '../services/signInOutbox.js';
import { checkNetworkStatus } from '../utils/networkUtils.js';
import { getFlexiRecordsList } from '../../features/events/services/flexiRecordService.js';
// TODO: Move getFlexiRecordStructure to shared layer to avoid circular dependency
// import { getFlexiRecordStructure } from '../../features/events/services/flexiRecordService.js';
import { parseFlexiStructure } from '../utils/flexiRecordTransforms.js';
import { getToken } from '../services/auth/tokenService.js';
import { safeGetSessionItem } from '../utils/storageUtils.js';
import { isDemoMode } from '../../config/demoMode.js';
import databaseService from '../services/storage/database.js';
import { IndexedDBService } from '../services/storage/indexedDBService.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';
import { CLEAR_STRING_SENTINEL, CLEAR_TIME_SENTINEL } from '../constants/signInDataConstants.js';

// Inter-call delay to prevent API clashing - tunable for flaky APIs

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

    // Pick up any ops left from a previous session (e.g. app was killed
    // offline) and retry them in the background.
    signInOutbox.installNetworkListener();
    signInOutbox.pendingCount().then((count) => {
      if (count > 0) {
        signInOutbox.drain().then(({ completed, remaining }) => {
          if (completed > 0 && onDataRefresh) {
            onDataRefresh();
          }
          if (remaining > 0 && notifyWarning) {
            notifyWarning(`${remaining} sign-in change(s) still waiting to sync to OSM.`);
          }
        });
      }
    });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get current user info from cached startup data
  const getCurrentUserInfo = async () => {
    // First try sessionStorage user_info (set during auth)
    const userInfo = safeGetSessionItem('user_info', {});
    if (userInfo.firstname && userInfo.lastname) {
      return userInfo;
    }

    const demoMode = isDemoMode();
    let startupData;
    if (demoMode) {
      const raw = localStorage.getItem('demo_viking_startup_data_offline');
      try {
        startupData = raw ? JSON.parse(raw) : {};
      } catch (_) {
        startupData = null;
      }
    } else {
      startupData = await IndexedDBService.get(IndexedDBService.STORES.CACHE_DATA, 'viking_startup_data') || {};
    }
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
      const allStructures = await databaseService.getAllFlexiStructures();

      if (allStructures.length > 0) {
        for (const structureData of allStructures) {
          try {
            const structureFlexiRecordId = structureData?.extraid || structureData?.flexirecordid;
            if (!structureFlexiRecordId) continue;

            let fieldMapping = structureData?.vikingFlexiRecord?.fieldMapping || structureData?._structure?.vikingFlexiRecord?.fieldMapping;

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
              return {
                extraid: structureFlexiRecordId,
                structure: structureData,
                fieldMapping: structureData?.vikingFlexiRecord?.fieldMapping || structureData?._structure?.vikingFlexiRecord?.fieldMapping,
              };
            }
          } catch (error) {
            console.warn('Failed to parse Viking Event structure:', structureData?.extraid, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load Viking Event data from normalized storage:', error);
    }

    // Fallback to Viking Event FlexiRecords approach (same as camp groups).
    // Only this API path needs a token; the cached-structure path above works offline.
    if (!token) {
      throw new Error('Viking Event flexirecord structure not cached - sign in to OSM once to load it.');
    }
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
          logger.error('Failed to parse FlexiRecord structure with parseFlexiStructure()', { error: parseError }, LOG_CATEGORIES.ERROR);

          // Fallback: try to access pre-parsed data (though this usually doesn't exist)
          if (structure?.vikingFlexiRecord?.fieldMapping) {
            fieldMapping = structure.vikingFlexiRecord.fieldMapping;
          } else if (structure?._structure?.vikingFlexiRecord?.fieldMapping) {
            fieldMapping = structure._structure.vikingFlexiRecord.fieldMapping;
          }
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

  // Main sign in/out handler: optimistic local write + persistent outbox.
  // The row updates instantly; the OSM writes drain through the rate-limit
  // queue, surviving offline gaps, app restarts, and mid-operation failures
  // (per-field progress is persisted, so nothing is half-written twice).
  const handleSignInOut = async (member, action) => {
    const opToken = getToken();
    const memberLabel = member.name || member.firstname || String(member.scoutid);

    try {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setButtonLoading(prev => ({ ...prev, [member.scoutid]: true }));

      const userInfo = await getCurrentUserInfo();
      const currentUser = `${userInfo.firstname} ${userInfo.lastname}`;
      const timestamp = new Date().toISOString();

      const event = events.find(e => e.sectionid === member.sectionid);
      const termId = event?.termid || (opToken ? await fetchMostRecentTermId(member.sectionid, opToken) : null);

      if (!termId) {
        throw new Error('No term ID available - required for flexirecord updates');
      }

      const cachedSections = await databaseService.getSections() || [];
      const sectionConfig = cachedSections.find(section => section.sectionid === member.sectionid);
      const sectionType = sectionConfig?.sectiontype || 'beavers';

      const vikingFlexiRecord = await getVikingEventFlexiRecord(member.sectionid, termId, opToken);

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const updates = action === 'signin'
        ? [
          { fieldId: getFieldId('SignedInBy', vikingFlexiRecord.fieldMapping), value: currentUser },
          { fieldId: getFieldId('SignedInWhen', vikingFlexiRecord.fieldMapping), value: timestamp },
          { fieldId: getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping), value: CLEAR_STRING_SENTINEL },
          { fieldId: getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping), value: CLEAR_TIME_SENTINEL },
        ]
        : [
          { fieldId: getFieldId('SignedOutBy', vikingFlexiRecord.fieldMapping), value: currentUser },
          { fieldId: getFieldId('SignedOutWhen', vikingFlexiRecord.fieldMapping), value: timestamp },
        ];

      const op = {
        id: `${member.scoutid}-${action}-${Date.now()}`,
        memberLabel,
        action,
        scoutid: member.scoutid,
        sectionid: member.sectionid,
        extraid: vikingFlexiRecord.extraid,
        termId,
        sectionType,
        updates,
        createdAt: timestamp,
      };

      // 1. Local first: the leader at the gate sees the row change immediately
      await signInOutbox.applyLocal(op);
      await signInOutbox.enqueue(op);

      // 2. Push to OSM now if we can
      const online = await checkNetworkStatus();
      let drainResult = { completed: 0, remaining: 1, errors: [] };
      if (online && opToken) {
        drainResult = await signInOutbox.drain(opToken);
      }

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (drainResult.remaining > 0) {
        const reason = !opToken
          ? 'sign in to OSM to sync'
          : (online ? 'will retry automatically' : 'will sync when back online');
        if (notifyWarning) {
          notifyWarning(`${memberLabel} ${action === 'signin' ? 'signed in' : 'signed out'} locally - ${reason}.`);
        }
        // Refresh from cache only - a network refetch would overwrite the
        // optimistic update with stale OSM data
        if (onDataRefresh) {
          await onDataRefresh({ cacheOnly: true });
        }
      } else if (onDataRefresh) {
        // Fully synced: refresh from OSM so this phone converges with others
        await onDataRefresh();
      }

    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      logger.error(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} member`, {
        member: { id: member.scoutid, label: memberLabel },
        action,
        error: error?.stack || error?.message || String(error),
      }, LOG_CATEGORIES.API);

      if (notifyError) {
        notifyError(`Failed to ${action === 'signin' ? 'sign in' : 'sign out'} ${memberLabel}: ${error.message}`);
      }
    } finally {
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