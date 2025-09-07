import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../contexts/app';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

// Custom hook for synchronizing application state with URL parameters
export function useURLSync() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, setNavigationData } = useAppState();
  
  // Update URL when navigation data changes
  const syncStateToURL = useCallback((stateData = {}) => {
    const newParams = new URLSearchParams(searchParams);
    
    // Clear existing navigation params
    newParams.delete('event');
    newParams.delete('section');
    
    // Add current navigation data to URL parameters
    const { selectedEvent, selectedSection } = stateData.navigationData || state.navigationData;
    
    if (selectedEvent) {
      newParams.set('event', selectedEvent);
    }
    
    if (selectedSection) {
      newParams.set('section', selectedSection);
    }
    
    // Update URL parameters without navigation
    setSearchParams(newParams, { replace: true });
    
    logger.debug('State synced to URL', {
      selectedEvent,
      selectedSection,
      urlParams: Object.fromEntries(newParams.entries()),
    }, LOG_CATEGORIES.APP);
    
  }, [searchParams, setSearchParams, state.navigationData]);

  // Navigate to a new route with optional state preservation
  const navigateWithState = useCallback((path, options = {}) => {
    const { preserveParams = true, state: navigationState, replace = false } = options;
    
    let finalPath = path;
    
    // Preserve URL parameters if requested
    if (preserveParams && searchParams.toString()) {
      const separator = path.includes('?') ? '&' : '?';
      finalPath = `${path}${separator}${searchParams.toString()}`;
    }
    
    const navigateOptions = { replace };
    if (navigationState) {
      navigateOptions.state = navigationState;
    }
    
    logger.debug('Navigating with state', {
      path: finalPath,
      preserveParams,
      hasState: !!navigationState,
    }, LOG_CATEGORIES.APP);
    
    navigate(finalPath, navigateOptions);
    
  }, [navigate, searchParams]);

  // Update navigation data and sync to URL
  const updateNavigationData = useCallback((data) => {
    setNavigationData(data);
    // Let React handle the URL sync through effects
  }, [setNavigationData]);

  // Load state from URL parameters on mount
  useEffect(() => {
    const selectedEvent = searchParams.get('event');
    const selectedSection = searchParams.get('section');
    
    if (selectedEvent || selectedSection) {
      const navigationData = {
        ...(selectedEvent && { selectedEvent }),
        ...(selectedSection && { selectedSection }),
      };
      
      setNavigationData(navigationData);
      
      logger.debug('Navigation data loaded from URL', {
        selectedEvent,
        selectedSection,
      }, LOG_CATEGORIES.APP);
    }
  }, [searchParams, setNavigationData]);

  return {
    // State synchronization
    syncStateToURL,
    updateNavigationData,
    
    // Navigation helpers
    navigateWithState,
    
    // URL parameter access
    searchParams,
    setSearchParams,
    
    // Current state
    navigationData: state.navigationData,
    currentView: state.currentView,
  };
}