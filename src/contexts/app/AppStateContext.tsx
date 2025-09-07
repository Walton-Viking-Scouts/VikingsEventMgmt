import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import logger, { LOG_CATEGORIES } from '../../services/logger.js';
import { safeGetItem, safeSetItem } from '../../utils/storageUtils.js';

// Types for application state
export interface NavigationData {
  events?: any[];
  members?: any[];
  selectedEvent?: string;
  selectedSection?: string;
}

export interface AppState {
  navigationData: NavigationData;
  currentView: string;
  isRefreshing: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

// Action types for state updates
export type AppStateAction =
  | { type: 'SET_NAVIGATION_DATA'; payload: NavigationData }
  | { type: 'SET_CURRENT_VIEW'; payload: string }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_LAST_SYNC_TIME'; payload: string | null }
  | { type: 'CLEAR_NAVIGATION_DATA' }
  | { type: 'SYNC_FROM_URL'; payload: { view: string; params: URLSearchParams } };

// Context type definition
export interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppStateAction>;
  // Convenience methods
  setNavigationData: (data: NavigationData) => void;
  clearNavigationData: () => void;
  setCurrentView: (view: string) => void;
  setRefreshing: (refreshing: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: string | null) => void;
}

// Storage keys for persistence
const STORAGE_KEYS = {
  NAVIGATION_DATA: 'viking_navigation_data',
  CURRENT_VIEW: 'viking_current_view',
  LAST_SYNC_TIME: 'viking_last_sync_time',
} as const;

// Initial state with localStorage persistence
const getInitialState = (): AppState => {
  return {
    navigationData: safeGetItem(STORAGE_KEYS.NAVIGATION_DATA, {}),
    currentView: safeGetItem(STORAGE_KEYS.CURRENT_VIEW, 'dashboard'),
    isRefreshing: false,
    isSyncing: false,
    lastSyncTime: safeGetItem(STORAGE_KEYS.LAST_SYNC_TIME, null),
  };
};

const initialState: AppState = getInitialState();

// State reducer
function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'SET_NAVIGATION_DATA':
      const newNavigationData = { ...state.navigationData, ...action.payload };
      safeSetItem(STORAGE_KEYS.NAVIGATION_DATA, newNavigationData);
      return {
        ...state,
        navigationData: newNavigationData,
      };

    case 'SET_CURRENT_VIEW':
      safeSetItem(STORAGE_KEYS.CURRENT_VIEW, action.payload);
      return {
        ...state,
        currentView: action.payload,
      };

    case 'SET_REFRESHING':
      return {
        ...state,
        isRefreshing: action.payload,
      };

    case 'SET_SYNCING':
      return {
        ...state,
        isSyncing: action.payload,
      };

    case 'SET_LAST_SYNC_TIME':
      safeSetItem(STORAGE_KEYS.LAST_SYNC_TIME, action.payload);
      return {
        ...state,
        lastSyncTime: action.payload,
      };

    case 'CLEAR_NAVIGATION_DATA':
      safeSetItem(STORAGE_KEYS.NAVIGATION_DATA, {});
      return {
        ...state,
        navigationData: {},
      };

    case 'SYNC_FROM_URL':
      // Sync state from URL parameters
      const urlState: Partial<AppState> = {
        currentView: action.payload.view,
      };
      
      // Extract specific URL parameters into navigation data
      const selectedEvent = action.payload.params.get('event');
      const selectedSection = action.payload.params.get('section');
      
      if (selectedEvent || selectedSection) {
        urlState.navigationData = {
          ...state.navigationData,
          ...(selectedEvent && { selectedEvent }),
          ...(selectedSection && { selectedSection }),
        };
      }
      
      return {
        ...state,
        ...urlState,
      };

    default:
      return state;
  }
}

// Create context
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Provider component
export interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Sync state with URL parameters on location changes
  useEffect(() => {
    // Extract view from pathname
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const view = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'dashboard';
    
    // Sync URL state with application state
    dispatch({
      type: 'SYNC_FROM_URL',
      payload: {
        view,
        params: searchParams,
      },
    });

    logger.debug('App state synced from URL', {
      pathname: location.pathname,
      view,
      searchParams: Object.fromEntries(searchParams.entries()),
    }, LOG_CATEGORIES.APP);

  }, [location.pathname, searchParams]);

  // Convenience methods
  const setNavigationData = (data: NavigationData) => {
    dispatch({ type: 'SET_NAVIGATION_DATA', payload: data });
  };

  const clearNavigationData = () => {
    dispatch({ type: 'CLEAR_NAVIGATION_DATA' });
  };

  const setCurrentView = (view: string) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  };

  const setRefreshing = (refreshing: boolean) => {
    dispatch({ type: 'SET_REFRESHING', payload: refreshing });
  };

  const setSyncing = (syncing: boolean) => {
    dispatch({ type: 'SET_SYNCING', payload: syncing });
  };

  const setLastSyncTime = (time: string | null) => {
    dispatch({ type: 'SET_LAST_SYNC_TIME', payload: time });
  };

  const contextValue: AppStateContextType = {
    state,
    dispatch,
    setNavigationData,
    clearNavigationData,
    setCurrentView,
    setRefreshing,
    setSyncing,
    setLastSyncTime,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

// Custom hook to use the app state context
export function useAppState(): AppStateContextType {
  const context = useContext(AppStateContext);
  
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  
  return context;
}

// Export the context for advanced use cases
export { AppStateContext };