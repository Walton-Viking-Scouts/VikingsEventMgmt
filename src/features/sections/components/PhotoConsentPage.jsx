import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import databaseService from '../../../shared/services/storage/database.js';
import { getListOfMembers } from '../../../shared/services/api/api/members.js';
import { getToken } from '../../../shared/services/auth/tokenService.js';
import { notifyError } from '../../../shared/utils/notifications.js';
import logger, { LOG_CATEGORIES } from '../../../shared/services/utils/logger.js';
import { groupNoConsentMembersBySection } from '../utils/photoConsentGallery.js';
import PhotoConsentGalleryMasonry from './PhotoConsentGalleryMasonry.jsx';

/**
 * Photo Consent Gallery
 *
 * A dedicated page for whoever is handling social media to instantly see
 * which members must not appear in photos. Shows only members whose
 * photographs consent is not an explicit 'Yes' (i.e. 'No', blank, or
 * missing), grouped into one masonry card per section, with a large photo
 * and name only — no age, patrol, or medical data.
 *
 * @component
 * @returns {JSX.Element}
 */
function PhotoConsentPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsError, setSectionsError] = useState(null);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [hideAdults, setHideAdults] = useState(false);

  useEffect(() => {
    const loadSections = async () => {
      try {
        setSectionsLoading(true);
        setSectionsError(null);
        const sectionsData = await databaseService.getSections();
        setSections(sectionsData || []);
      } catch (err) {
        logger.error('Failed to load sections from cache', {
          error: err.message,
        }, LOG_CATEGORIES.ERROR);
        setSectionsError(err.message);
        setSections([]);
      } finally {
        setSectionsLoading(false);
      }
    };

    loadSections();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (selectedSections.length === 0) {
        setMembers([]);
        return;
      }

      try {
        setMembersLoading(true);
        const token = getToken();
        const membersData = await getListOfMembers(selectedSections, token);
        if (!cancelled) {
          setMembers(membersData || []);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to load members', { error }, LOG_CATEGORIES.API);
          notifyError('Failed to load members. Please check your connection and try again.');
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [selectedSections]);

  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  const handleSectionToggle = (section) => {
    setSelectedSections((prev) => {
      const isSelected = prev.some((s) => s.sectionid === section.sectionid);
      if (isSelected) {
        return prev.filter((s) => s.sectionid !== section.sectionid);
      }
      return [...prev, section];
    });
  };

  const noConsentSections = useMemo(
    () => groupNoConsentMembersBySection(members, { hideAdults, sections: selectedSections }),
    [members, hideAdults, selectedSections],
  );

  const sortedSections = useMemo(
    () => sections.slice().sort((a, b) => (a.sectionname || '').localeCompare(b.sectionname || '')),
    [sections],
  );

  if (sectionsLoading) {
    return <LoadingScreen message="Loading sections..." />;
  }

  if (sectionsError) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-scout-red">
              <h2 className="text-lg font-semibold mb-2">Error Loading Sections</h2>
              <p>{sectionsError}</p>
              <button
                onClick={() => navigate('/sections')}
                className="mt-4 px-4 py-2 bg-scout-blue text-white rounded hover:bg-scout-blue-dark"
              >
                Back to Sections
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Photo Consent Gallery</h2>
          <p className="text-gray-600 mt-1">
            Members without photo consent — do not publish photos of these members.
          </p>
        </div>

        <div className="space-y-3 mb-6 p-3 bg-gray-50 rounded border-b border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sections:
            </label>
            <div className="flex flex-wrap gap-2">
              {sortedSections.map((section) => {
                const isSelected = selectedSections.some((s) => s.sectionid === section.sectionid);
                return (
                  <button
                    key={section.sectionid}
                    onClick={() => handleSectionToggle(section)}
                    className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-scout-blue text-white border-scout-blue'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    type="button"
                  >
                    {section.sectionname}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setHideAdults((prev) => !prev)}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  hideAdults
                    ? 'bg-scout-blue text-white border-scout-blue'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                type="button"
              >
                Hide Adults
              </button>
            </div>
          </div>
        </div>

        {membersLoading ? (
          <LoadingScreen message="Loading members..." />
        ) : selectedSections.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Select a section above to see who must not appear in photos.</p>
          </div>
        ) : noConsentSections.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Everyone in the selected sections has given photo consent.</p>
          </div>
        ) : (
          <PhotoConsentGalleryMasonry sections={noConsentSections} />
        )}
      </div>
    </>
  );
}

export default PhotoConsentPage;
