import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import { getListOfMembers } from '../../../shared/services/api/api.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { getMostRecentTermId } from '../../../shared/utils/termUtils.js';

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
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  // Load young leaders data on component mount
  useEffect(() => {
    const loadYoungLeaders = async () => {
      const startTime = Date.now();
      let sectionsProcessed = 0;
      let sectionsSuccessful = 0;
      let sectionsFailed = 0;

      try {
        setLoading(true);
        setError(null);

        // Get all sections to fetch members from
        const sections = await databaseService.getSections();
        if (!sections || sections.length === 0) {
          setYoungLeaders([]);
          setLoading(false);
          return;
        }

        logger.debug('Starting Young Leaders data load', {
          sectionCount: sections.length,
          timestamp: new Date().toISOString(),
        }, LOG_CATEGORIES.APP);

        // Get authentication token for API calls
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        // Use getListOfMembers which properly handles section names and deduplication
        const allMembers = await getListOfMembers(sections, token);

        // Filter for Young Leaders - only include those with person_type === 'Young Leaders'
        // This excludes Adults section memberships to avoid incorrect classification
        const youngLeaderMembers = allMembers.filter(member => {
          return member.person_type === 'Young Leaders';
        });

        setYoungLeaders(youngLeaderMembers || []);

        const loadTime = Date.now() - startTime;
        logger.info('Young Leaders loading completed', {
          totalLoadTime: `${loadTime}ms`,
          totalMembers: allMembers.length,
          youngLeadersCount: youngLeaderMembers?.length || 0,
          sectionsProcessed,
          sectionsSuccessful,
          sectionsFailed,
          successRate: sectionsProcessed > 0 ? `${Math.round((sectionsSuccessful / sectionsProcessed) * 100)}%` : '0%',
        }, LOG_CATEGORIES.APP);

        // Show warning if many sections failed but still show available data
        if (sectionsFailed > sectionsSuccessful && sectionsProcessed > 1) {
          logger.warn('Many sections failed to load - showing available data only', {
            sectionsSuccessful,
            sectionsFailed,
            youngLeadersFound: youngLeaderMembers?.length || 0,
          }, LOG_CATEGORIES.APP);
        }

      } catch (err) {
        const loadTime = Date.now() - startTime;
        logger.error('Failed to load young leaders', {
          error: err.message,
          loadTime: `${loadTime}ms`,
          sectionsProcessed,
          sectionsSuccessful,
          sectionsFailed,
        }, LOG_CATEGORIES.ERROR);
        setError(err.message);
        setYoungLeaders([]);
      } finally {
        setLoading(false);
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
    return <LoadingScreen message="Loading young leaders..." />;
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
          <h2 className="text-2xl font-bold text-gray-900">Young Leaders</h2>
          <p className="text-gray-600 mt-1">
            View and manage young leader information and development tracking
          </p>
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