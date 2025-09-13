import { useState, useEffect, useCallback } from 'react';
import { 
  discoverVikingSectionMoversFlexiRecords,
  getVikingSectionMoversData,
  extractVikingSectionMoversContext,
  validateVikingSectionMoversCollection,
} from '../services/flexiRecordService.js';
import { getToken } from '../services/auth.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 *
 * @param sectionId
 * @param termId
 */
export function useVikingSectionMovers(sectionId, termId) {
  // Core data state
  const [discoveredFlexiRecords, setDiscoveredFlexiRecords] = useState([]);
  const [fieldMappings, setFieldMappings] = useState(new Map());
  const [validationResults, setValidationResults] = useState(null);
  
  // Loading and error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Validation and status state
  const [validationStatus, setValidationStatus] = useState({ 
    isValid: true,
    discoveredCount: 0,
    validCount: 0,
    invalidCount: 0,
  });
  
  // Cache and refresh state
  const [lastFetch, setLastFetch] = useState(null);
  const [cacheStatus, setCacheStatus] = useState('empty');

  const discoverAndMapFlexiRecords = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setCacheStatus('loading');

      const token = getToken();
        
      // Step 1: Discover all Viking Section Movers FlexiRecords
      const discovered = await discoverVikingSectionMoversFlexiRecords(token, forceRefresh);

      // Step 2: Extract field mappings for each discovered FlexiRecord
      const mappingPromises = discovered.map(async (discoveredRecord) => {
        try {
          // Get the full FlexiRecord data for field mapping
          const flexiRecordData = await getVikingSectionMoversData(
            discoveredRecord.sectionId,
            termId,
            token,
            forceRefresh,
          );

          if (flexiRecordData) {
            // Extract field mapping context
            const fieldContext = extractVikingSectionMoversContext(
              flexiRecordData,
              discoveredRecord.sectionId,
              termId,
              discoveredRecord.sectionName,
            );

            return {
              sectionId: discoveredRecord.sectionId,
              fieldContext,
            };
          }

          return { sectionId: discoveredRecord.sectionId, fieldContext: null };
        } catch (err) {
          logger.warn('Failed to extract field mapping for section', {
            sectionId: discoveredRecord.sectionId,
            sectionName: discoveredRecord.sectionName,
            error: err.message,
          }, LOG_CATEGORIES.APP);

          return { sectionId: discoveredRecord.sectionId, fieldContext: null };
        }
      });

      const mappingResults = await Promise.all(mappingPromises);

      // Build field mappings Map
      const mappings = new Map();
      mappingResults.forEach(({ sectionId, fieldContext }) => {
        if (fieldContext) {
          mappings.set(sectionId, fieldContext);
        }
      });

      setDiscoveredFlexiRecords(discovered);
      setFieldMappings(mappings);
        
      // Step 3: Validate the discovered FlexiRecords and field mappings
      const validation = validateVikingSectionMoversCollection(discovered, mappings);
      setValidationResults(validation);
        
      const newValidationStatus = {
        isValid: validation.isValid,
        discoveredCount: discovered.length,
        validCount: validation.summary.valid,
        invalidCount: validation.summary.invalid,
        sections: discovered.map(d => d.sectionName),
        validSections: validation.validRecords.map(r => r.sectionName),
        invalidSections: validation.invalidRecords.map(r => ({
          sectionName: r.sectionName,
          error: r.validationError,
        })),
      };
        
      setValidationStatus(newValidationStatus);
      setLastFetch(new Date().toISOString());
      setCacheStatus(validation.isValid ? 'loaded' : 'error');

      logger.info('Viking Section Movers discovery, mapping, and validation completed', {
        discoveredCount: discovered.length,
        validCount: validation.summary.valid,
        invalidCount: validation.summary.invalid,
        sectionId,
        termId,
        cacheStatus: validation.isValid ? 'loaded' : 'error',
      }, LOG_CATEGORIES.APP);

    } catch (err) {
      logger.error('Failed to discover and map Viking Section Movers FlexiRecords', {
        error: err.message,
        sectionId,
        termId,
      }, LOG_CATEGORIES.ERROR);

      setError(err.message);
      setValidationStatus({ isValid: false, error: err.message, discoveredCount: 0, validCount: 0, invalidCount: 0 });
      setCacheStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [sectionId, termId]);

  useEffect(() => {
    const loadData = async () => {
      await discoverAndMapFlexiRecords();
    };

    loadData();
  }, [sectionId, termId, discoverAndMapFlexiRecords]);

  const validateFlexiRecord = async () => {
    return validationStatus;
  };

  const getFieldMappingForSection = (targetSectionId) => {
    return fieldMappings.get(targetSectionId) || null;
  };

  const refreshData = async () => {
    await discoverAndMapFlexiRecords(true);
  };

  const getCacheAge = () => {
    if (!lastFetch) return null;
    return Date.now() - new Date(lastFetch).getTime();
  };

  const shouldRefreshCache = (maxAgeMs = 5 * 60 * 1000) => {
    const age = getCacheAge();
    return age === null || age > maxAgeMs;
  };

  return {
    discoveredFlexiRecords,
    fieldMappings,
    validationResults,
    validationStatus,
    fieldMapping: fieldMappings, // For backward compatibility
    isLoading,
    error,
    lastFetch,
    cacheStatus,
    validateFlexiRecord,
    getFieldMappingForSection,
    refreshData,
    getCacheAge,
    shouldRefreshCache,
    isValid: validationStatus.isValid,
  };
}