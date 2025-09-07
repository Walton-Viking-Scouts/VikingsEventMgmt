import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ResponsiveLayout from '../../components/ResponsiveLayout.jsx';
import { NotificationProvider } from '../../adapters';
import { useNotification } from '../../contexts/notifications/NotificationContext';
import ToastContainer from '../../components/notifications/ToastContainer';
import { SectionsList } from '../../components/sections';
import MainNavigation from '../../components/MainNavigation.jsx';
import databaseService from '../../services/database.js';

function SectionsPageContent() {
  const navigate = useNavigate();
  const {
    user,
    isOfflineMode,
    authState,
    lastSyncTime,
    login,
    logout,
  } = useAuth();
  
  const { notifications, remove } = useNotification();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Sections-specific state
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [loadingSection] = useState(null);

  const handleRefresh = async () => {
    if (isOfflineMode) {
      return;
    }
    setIsRefreshing(true);
    try {
      const { default: syncService } = await import('../../services/sync.js');
      await syncService.syncAll();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load sections data on component mount
  useEffect(() => {
    const loadSections = async () => {
      try {
        const sectionsData = await databaseService.getSections();
        setSections(sectionsData || []);
      } catch (error) {
        console.error('Failed to load sections:', error);
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

  // Handle navigation to movers
  const handleNavigateToSectionMovements = () => {
    navigate('/movers');
  };

  return (
    <div className="sections-page">
      <ToastContainer toasts={notifications} onDismiss={remove} />
      <ResponsiveLayout
        user={user}
        onLogout={logout}
        onLogin={login}
        onRefresh={handleRefresh}
        currentView="sections"
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        isRefreshing={isRefreshing}
      >
        <MainNavigation onNavigateToSectionMovements={handleNavigateToSectionMovements} />
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Sections Management</h1>
              <p className="text-gray-600 mt-1">
                Select sections to view their member details and information.
              </p>
            </div>
            
            <SectionsList
              sections={sections}
              selectedSections={selectedSections}
              onSectionToggle={handleSectionToggle}
              loadingSection={loadingSection}
              allSections={sections}
            />
          </div>
        </div>
      </ResponsiveLayout>
    </div>
  );
}

function SectionsPage() {
  return (
    <NotificationProvider>
      <SectionsPageContent />
    </NotificationProvider>
  );
}

export default SectionsPage;