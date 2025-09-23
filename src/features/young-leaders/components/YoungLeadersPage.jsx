import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import { getListOfMembers, getTerms } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { UnifiedStorageService } from '../../../shared/services/storage/unifiedStorageService.js';
import { isDemoMode } from '../../../config/demoMode.js';

const sortData = (data, key, direction) => {
  return [...data].sort((a, b) => {
    let aValue, bValue;

    switch (key) {
    case 'name':
      aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
      bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
      break;
    case 'dob':
      aValue = a.date_of_birth || a.dob || '9999-12-31';
      bValue = b.date_of_birth || b.dob || '9999-12-31';
      break;
    case 'section':
      aValue = a.sectionname?.toLowerCase() || '';
      bValue = b.sectionname?.toLowerCase() || '';
      break;
    default:
      aValue = '';
      bValue = '';
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

const getSortIcon = (columnKey, currentSortKey, direction) => {
  if (currentSortKey !== columnKey) {
    return (
      <span className="ml-1 text-gray-400">
        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </span>
    );
  }

  return direction === 'asc' ? (
    <span className="ml-1 text-scout-blue">
      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    </span>
  ) : (
    <span className="ml-1 text-scout-blue">
      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
};

function YoungLeadersPage() {
  const navigate = useNavigate();
  const [youngLeaders, setYoungLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [loadingProgress] = useState({ loaded: 0, total: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  const handleRefreshData = () => {
    window.location.reload();
  };

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  // Load young leaders data by refreshing member grids for all sections
  useEffect(() => {
    const loadYoungLeaders = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);
        setError(null);
        setRefreshing(true);

        // Get all sections to fetch members from
        const sections = await databaseService.getSections();
        if (!sections || sections.length === 0) {
          setYoungLeaders([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }



        // Get authentication token for API calls
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        // Load terms once for all sections (major optimization!)
        let allTerms = null;
        if (token) {
          try {
            allTerms = await getTerms(token);
          } catch (err) {
            logger.error('Error loading terms, will use fallback', { error: err.message }, LOG_CATEGORIES.ERROR);
          }
        }

        // Fallback to offline cached terms if API failed
        if (!allTerms) {
          try {
            const demoMode = isDemoMode();
            const termsKey = demoMode ? 'demo_viking_terms_offline' : 'viking_terms_offline';
            const cachedTerms = await UnifiedStorageService.get(termsKey);
            if (cachedTerms) {
              allTerms = typeof cachedTerms === 'string' ? JSON.parse(cachedTerms) : cachedTerms;
            }
          } catch (err) {
            logger.warn('Failed to parse offline terms from storage', { error: err.message }, LOG_CATEGORIES.APP);
          }
        }

        // Use cached data to avoid excessive API calls
        const allMembers = await getListOfMembers(sections, token);
        const youngLeaderMembers = allMembers.filter(member => {
          return member.person_type === 'Young Leaders';
        });

        // Create section name lookup map from sections data
        const sectionNameMap = {};
        sections.forEach(section => {
          if (section.sectionid && section.sectionname) {
            sectionNameMap[section.sectionid] = section.sectionname;
          }
        });

        // Fix missing section names using section lookup
        const youngLeadersWithSectionNames = youngLeaderMembers.map(leader => {
          if (!leader.sectionname || leader.sectionname === 'Unknown Section') {
            // Try to find section name from the member's section ID
            if (leader.sectionid && sectionNameMap[leader.sectionid]) {
              return {
                ...leader,
                sectionname: sectionNameMap[leader.sectionid],
              };
            }
          }
          return leader;
        });

        setYoungLeaders(youngLeadersWithSectionNames || []);


      } catch (err) {
        const loadTime = Date.now() - startTime;
        logger.error('Failed to refresh young leaders', {
          error: err.message,
          loadTime: `${loadTime}ms`,
        }, LOG_CATEGORIES.ERROR);
        setError(err.message);
        setYoungLeaders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    // Add overall page timeout protection
    const pageTimeoutId = setTimeout(() => {
      logger.error('Young Leaders page loading timed out - forcing completion', {
        timeoutDuration: '30000ms',
      }, LOG_CATEGORIES.ERROR);
      setLoading(false);
      setError('Loading timed out - some data may be incomplete. Please try refreshing the page.');
    }, 30000);

    loadYoungLeaders().finally(() => {
      clearTimeout(pageTimeoutId);
    });

    // Cleanup timeout on unmount
    return () => {
      clearTimeout(pageTimeoutId);
    };
  }, []);

  if (loading) {
    const progressMessage = refreshing && loadingProgress.total > 0
      ? `Loading young leaders... (${loadingProgress.loaded}/${loadingProgress.total} sections)`
      : 'Loading young leaders...';
    return <LoadingScreen message={progressMessage} />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Young Leaders</h2>
              <p>{error}</p>
              <button
                onClick={() => navigate('/events')}
                className="mt-4 px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Events Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
      {/* Young Leaders Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Young Leaders</h2>
              <p className="text-gray-600 mt-1">
                View and manage young leader information and development tracking
              </p>
            </div>
            <button
              onClick={handleRefreshData}
              disabled={refreshing}
              className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
          {refreshing && loadingProgress.total > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">
                  Refreshing member data from all sections
                </span>
                <span className="text-sm text-blue-600">
                  {loadingProgress.loaded}/{loadingProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {youngLeaders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Young Leaders Found</h3>
            <p className="text-gray-600 mb-4">
              No young leaders found in your sections. Make sure you&apos;re connected and data has been synced.
            </p>
            <button
              onClick={() => navigate('/events')}
              className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
            >
              Back to Events Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Young Leaders ({youngLeaders.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name {getSortIcon('name', sortConfig.key, sortConfig.direction)}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('dob')}
                    >
                      <div className="flex items-center">
                        Date of Birth {getSortIcon('dob', sortConfig.key, sortConfig.direction)}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('section')}
                    >
                      <div className="flex items-center">
                        Section Name {getSortIcon('section', sortConfig.key, sortConfig.direction)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortData(youngLeaders, sortConfig.key, sortConfig.direction).map((leader) => (
                    <tr key={leader.scoutid || leader.memberid} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {leader.firstname} {leader.lastname}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {(leader.date_of_birth || leader.dob) ? new Date(leader.date_of_birth || leader.dob).toLocaleDateString() : 'Not available'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {leader.sectionname || 'Unknown Section'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default YoungLeadersPage;