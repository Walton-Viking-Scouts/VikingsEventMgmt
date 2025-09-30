import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { SectionsList } from '../components';
import { RefreshButton } from '../../../shared/components/ui';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import { notifyError, notifySuccess } from '../../../shared/utils/notifications.js';
import { formatLastRefresh } from '../../../shared/utils/timeFormatting.js';

function SectionsPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingSection] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  // Load sections data function (reusable for refresh)
  const loadSections = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      const sectionsData = await databaseService.getSections();
      setSections(sectionsData || []);

      logger.debug('Sections loaded from cache', {
        sectionsCount: sectionsData?.length || 0,
        isRefresh,
      }, LOG_CATEGORIES.APP);

      return { success: true, count: sectionsData?.length || 0 };
    } catch (err) {
      logger.error('Failed to load sections from cache', {
        error: err.message,
        isRefresh,
      }, LOG_CATEGORIES.ERROR);

      if (!isRefresh) {
        setError(err.message);
        setSections([]);
      }

      return { success: false, error: err.message };
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  };

  // Manual refresh handler following Task 2 SimpleAttendanceViewer pattern
  const handleManualRefresh = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);

      logger.info('Manual sections refresh initiated', {}, LOG_CATEGORIES.COMPONENT);

      const result = await loadSections(true);

      if (result.success) {
        setLastRefresh(new Date());
        notifySuccess(`Refreshed sections data - ${result.count} sections loaded`);

        logger.info('Sections refresh completed successfully', {
          sectionsCount: result.count,
        }, LOG_CATEGORIES.COMPONENT);
      } else {
        notifyError(`Failed to refresh sections: ${result.error}`);

        logger.error('Manual sections refresh failed', {
          error: result.error,
        }, LOG_CATEGORIES.ERROR);
      }

    } catch (error) {
      logger.error('Manual sections refresh failed', {
        error: error.message,
      }, LOG_CATEGORIES.ERROR);

      notifyError(`Refresh failed: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Format last refresh time following SimpleAttendanceViewer pattern

  // Load sections data on component mount
  useEffect(() => {
    loadSections(false);
  }, []);

  // Handle section selection
  const handleSectionToggle = (section) => {
    setSelectedSections((prev) => {
      const isSelected = prev.some((s) => s.sectionid === section.sectionid);
      if (isSelected) {
        return prev.filter((s) => s.sectionid !== section.sectionid);
      } else {
        return [...prev, section];
      }
    });
  };

  if (loading) {
    return <LoadingScreen message="Loading sections..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-red-600">
              <h2 className="text-lg font-semibold mb-2">Error Loading Sections</h2>
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
      {/* Sections Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Sections</h2>
              <p className="text-gray-600 mt-1">
                View and manage section information and member data
              </p>
            </div>
            <RefreshButton
              onRefresh={handleManualRefresh}
              loading={refreshing}
              size="default"
            />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Last refreshed: {formatLastRefresh(lastRefresh)}
            {sections.length > 0 && (
              <span> • {sections.length} sections</span>
            )}
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sections Available</h3>
            <p className="text-gray-600 mb-4">
              No sections found. Make sure you&apos;re connected and data has been synced.
            </p>
            <button
              onClick={() => navigate('/events')}
              className="px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
            >
              Back to Events Dashboard
            </button>
          </div>
        ) : (
          <SectionsList
            sections={sections}
            selectedSections={selectedSections}
            onSectionToggle={handleSectionToggle}
            loadingSection={loadingSection}
            allSections={sections}
          />
        )}
      </div>
    </>
  );
}

export default SectionsPage;