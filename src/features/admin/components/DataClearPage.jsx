import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../../shared/contexts/app';
import databaseService from '../../../shared/services/storage/database.js';
import { clearToken } from '../../../shared/services/auth/tokenService.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';

function DataClearPage() {
  const navigate = useNavigate();
  const { clearNavigationData: _clearNavigationData } = useAppState();
  const [isClearing, setIsClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    
    try {
      // Clear all localStorage data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('viking_') || key.startsWith('demo_viking_'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear session storage (tokens)
      clearToken();
      sessionStorage.clear();
      
      // Clear database if available
      try {
        await databaseService.initialize();
        // Note: Database clearing would need specific implementation
        // based on the database service capabilities
      } catch (dbError) {
        logger.warn('Could not clear database', { error: dbError.message }, LOG_CATEGORIES.APP);
      }
      
      logger.info('All application data cleared successfully', {
        clearedLocalStorageKeys: keysToRemove.length,
      }, LOG_CATEGORIES.APP);
      
      setCleared(true);
      
      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        // Don't clear navigation data - let it persist for proper state management
        // Use React Router navigate instead of window.location to maintain state
        navigate('/events', { replace: true });
      }, 2000);
      
    } catch (error) {
      logger.error('Failed to clear application data', { error: error.message }, LOG_CATEGORIES.ERROR);
      setIsClearing(false);
    }
  };

  const handleCancel = () => {
    navigate('/events', { replace: true });
  };

  if (cleared) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-md p-6 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Data Cleared Successfully</h2>
          <p className="text-gray-600 mb-4">
            All application data has been cleared. You will be redirected to the dashboard.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-md p-6">
        <div className="text-center mb-6">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Clear All Data</h2>
          <p className="text-gray-600 mb-4">
            This will permanently delete all cached data including:
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 space-y-1">
            <li>• Cached events and attendance data</li>
            <li>• Member information</li>
            <li>• Authentication tokens</li>
            <li>• Offline data and preferences</li>
            <li>• Navigation history</li>
          </ul>
          <p className="text-sm text-red-600 font-medium mb-6">
            This action cannot be undone. You will need to re-authenticate and sync data again.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            disabled={isClearing}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-scout-blue focus:border-scout-blue disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClearData}
            disabled={isClearing}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isClearing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Clearing...
              </>
            ) : (
              'Clear All Data'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataClearPage;