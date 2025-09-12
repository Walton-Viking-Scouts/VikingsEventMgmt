import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import { SectionsList } from '../components';
import databaseService from '../../../shared/services/storage/database.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';

/**
 *
 */
function SectionsPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingSection] = useState(null);

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  // Load sections data on component mount
  useEffect(() => {
    const loadSections = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sectionsData = await databaseService.getSections();
        setSections(sectionsData || []);
        
        logger.debug('Sections loaded from cache', {
          sectionsCount: sectionsData?.length || 0,
        }, LOG_CATEGORIES.APP);
      } catch (err) {
        logger.error('Failed to load sections from cache', { error: err.message }, LOG_CATEGORIES.ERROR);
        setError(err.message);
        setSections([]);
      } finally {
        setLoading(false);
      }
    };

    loadSections();
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
          <h2 className="text-2xl font-bold text-gray-900">Sections</h2>
          <p className="text-gray-600 mt-1">
            View and manage section information and member data
          </p>
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