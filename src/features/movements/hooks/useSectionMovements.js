import { useState, useEffect, useCallback } from 'react';
import databaseService from '../../../shared/services/storage/database.js';
import { 
  discoverVikingSectionMoversFlexiRecords,
  getVikingSectionMoversData,
} from '../../events/services/flexiRecordService.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { fetchMostRecentTermId } from '../../../shared/services/api/api.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

export default function useSectionMovements() {
  const [sections, setSections] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flexiRecordLoadingState, setFlexiRecordLoadingState] = useState({
    loading: false,
    error: null,
    loadedSections: new Set(),
  });

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get sections data first
        const sectionsData = await databaseService.getSections();
        if (!isMounted) return;

        setSections(sectionsData || []);

        // Load Viking Section Movers FlexiRecords for all sections
        if (sectionsData && sectionsData.length > 0) {
          await loadFlexiRecordsForAllSections(sectionsData);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct cache access function - bypasses API discovery when it fails
  const loadFlexiRecordsFromDirectCache = async (sectionsData) => {
    const allMembersData = [];
    
    for (const section of sectionsData) {
      try {
        const sectionId = section.sectionid;
        const sectionName = section.sectionname || section.name || 'Unknown Section';
        
        // Check if there's cached FlexiRecord list for this section
        const cacheKey = `viking_flexi_lists_${sectionId}_offline`;
        const cachedList = localStorage.getItem(cacheKey);
        
        if (cachedList) {
          const parsedList = JSON.parse(cachedList);
          
          // Find Viking Section Movers FlexiRecord
          const vikingMoversRecord = parsedList.items?.find(record => 
            record.name === 'Viking Section Movers',
          );
          
          if (vikingMoversRecord) {
            
            // Try to load the actual FlexiRecord data
            const allKeys = Object.keys(localStorage);
            const matchingDataKeys = allKeys.filter(key => 
              key.includes(`viking_flexi_data_${vikingMoversRecord.extraid}_${sectionId}_`),
            );
            
            if (matchingDataKeys.length > 0) {
              const dataKey = matchingDataKeys[0]; // Use first matching key
              const cachedData = localStorage.getItem(dataKey);
              
              if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                
                // Add members with consistent section information
                const membersWithSection = (parsedData.items || []).map(member => ({
                  ...member,
                  section_id: sectionId,
                  sectionid: sectionId,
                  sectionname: sectionName,
                }));
                
                allMembersData.push(...membersWithSection);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`❌ Error loading direct cache for section ${section.sectionid}:`, error.message);
      }
    }
    
    return allMembersData;
  };

  const loadFlexiRecordsForAllSections = useCallback(async (sectionsData, forceRefresh = false) => {
    setFlexiRecordLoadingState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = getToken();
      if (!token) {
        logger.warn('No auth token available for loading FlexiRecords - trying offline/cached data', {}, LOG_CATEGORIES.APP);
      }

      // Discover ALL Viking Section Movers FlexiRecords once (not per section)
      // This will work with or without token - it will use cached data when offline
      const discoveredRecords = await discoverVikingSectionMoversFlexiRecords(token);
      
      if (!discoveredRecords || discoveredRecords.length === 0) {
        logger.warn('No Viking Section Movers FlexiRecords discovered via API, trying direct cache access', {
          sectionCount: sectionsData.length,
        }, LOG_CATEGORIES.APP);
        
        // FALLBACK: Try to load data directly from cache since discovery failed
        const directCacheResults = await loadFlexiRecordsFromDirectCache(sectionsData);
        if (directCacheResults.length > 0) {
          logger.info('Successfully loaded Viking Section Movers from direct cache', {
            recordCount: directCacheResults.length,
          }, LOG_CATEGORIES.APP);
          
          setMembers(directCacheResults);
          setFlexiRecordLoadingState({ 
            loading: false, 
            error: null, 
            loadedSections: new Set(directCacheResults.map(m => m.section_id)), 
          });
          setLoading(false);
          return;
        }
        
        setFlexiRecordLoadingState(prev => ({ ...prev, loading: false }));
        setLoading(false);
        return;
      }

      logger.info('Discovered Viking Section Movers FlexiRecords', {
        totalDiscovered: discoveredRecords.length,
        recordsBySection: discoveredRecords.map(r => ({
          sectionId: r.sectionId,
          sectionName: r.sectionName,
        })),
      }, LOG_CATEGORIES.APP);

      const allMembersData = [];
      const loadedSections = new Set();

      // Process each discovered FlexiRecord with its section's most recent term ID
      for (const record of discoveredRecords) {
        try {
          // Get the most recent term ID for THIS FlexiRecord's section
          const sectionTermId = await fetchMostRecentTermId(record.sectionId, token);
          
          if (!sectionTermId) {
            logger.warn('Could not get most recent term ID for FlexiRecord section', {
              sectionId: record.sectionId,
              sectionName: record.sectionName,
            }, LOG_CATEGORIES.APP);
            continue;
          }

          // Load member data from this specific FlexiRecord
          const flexiData = await getVikingSectionMoversData(record.sectionId, sectionTermId, token, forceRefresh);
          const members = flexiData?.items || [];
          
          logger.info('Loaded members from FlexiRecord', {
            sectionId: record.sectionId,
            sectionName: record.sectionName,
            memberCount: members.length,
            termId: sectionTermId,
          }, LOG_CATEGORIES.APP);
          
          // Add members with consistent section information
          const membersWithSection = members.map(member => ({
            ...member,
            section_id: record.sectionId,
            sectionid: record.sectionId,
            sectionname: record.sectionName,
          }));

          allMembersData.push(...membersWithSection);
          loadedSections.add(record.sectionId);
        } catch (error) {
          logger.warn('Failed to load members from FlexiRecord', {
            sectionId: record.sectionId,
            sectionName: record.sectionName,
            error: error.message,
          }, LOG_CATEGORIES.APP);
        }
      }

      logger.info('Completed loading Viking Section Movers FlexiRecords for all sections', {
        totalSections: sectionsData.length,
        totalMembersLoaded: allMembersData.length,
        sectionsWithData: loadedSections.size,
      }, LOG_CATEGORIES.APP);

      setMembers(allMembersData);
      setFlexiRecordLoadingState({ 
        loading: false, 
        error: null, 
        loadedSections, 
      });
      setLoading(false);

    } catch (error) {
      logger.error('Error loading FlexiRecords for all sections', {
        error: error.message,
        sectionCount: sectionsData.length,
      }, LOG_CATEGORIES.ERROR);
      
      setFlexiRecordLoadingState({ 
        loading: false, 
        error: error.message, 
        loadedSections: new Set(), 
      });
      setError(error.message);
      setLoading(false);
    }
  }, [setFlexiRecordLoadingState, setMembers, setLoading, setError]);


  const refetch = async () => {
    setLoading(true);
    setError(null);
    setFlexiRecordLoadingState({ loading: false, error: null, loadedSections: new Set() });
    
    try {
      const sectionsData = await databaseService.getSections();
      setSections(sectionsData || []);
      
      // Reload FlexiRecord data for all sections with forceRefresh = true
      if (sectionsData && sectionsData.length > 0) {
        await loadFlexiRecordsForAllSections(sectionsData, true);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return {
    sections,
    members,
    loading: loading || flexiRecordLoadingState.loading,
    error: error || flexiRecordLoadingState.error,
    refetch,
    // FlexiRecord loading information for debugging
    flexiRecordState: flexiRecordLoadingState,
  };
}