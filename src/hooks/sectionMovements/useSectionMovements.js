import { useState, useEffect } from 'react';
import databaseService from '../../services/database.js';
import { 
  discoverVikingSectionMoversFlexiRecords,
  getVikingSectionMoversData,
} from '../../services/flexiRecordService.js';
import { getToken } from '../../services/auth.js';
import { fetchMostRecentTermId } from '../../services/api.js';
import logger, { LOG_CATEGORIES } from '../../services/logger.js';

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
  }, []);

  const loadFlexiRecordsForAllSections = async (sectionsData, forceRefresh = false) => {
    setFlexiRecordLoadingState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = getToken();
      if (!token) {
        logger.warn('No auth token available for loading FlexiRecords', {}, LOG_CATEGORIES.APP);
        setFlexiRecordLoadingState(prev => ({ ...prev, loading: false }));
        setLoading(false);
        return;
      }

      // Discover ALL Viking Section Movers FlexiRecords once (not per section)
      const discoveredRecords = await discoverVikingSectionMoversFlexiRecords(token);
      
      if (!discoveredRecords || discoveredRecords.length === 0) {
        logger.warn('No Viking Section Movers FlexiRecords discovered', {
          sectionCount: sectionsData.length,
        }, LOG_CATEGORIES.APP);
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
  };


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