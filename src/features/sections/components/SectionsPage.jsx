import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth.js';
import ResponsiveLayout from '../../../shared/components/layout/ResponsiveLayout.jsx';
import { NotificationProvider } from '../../../shared/adapters';
import { useNotification } from '../../../shared/contexts/notifications/NotificationContext';
import ToastContainer from '../../../shared/components/notifications/ToastContainer';
import TokenExpiredDialog from '../../../shared/components/TokenExpiredDialog.jsx';
import { SectionsList } from '../components';
import MainNavigation from '../../../shared/components/layout/MainNavigation.jsx';
import databaseService from '../../../shared/services/storage/database.js';

function SectionsPageContent() {
  const navigate = useNavigate();
  const {
    user,
    isOfflineMode,
    authState,
    lastSyncTime,
    showTokenExpiredDialog,
    hasCachedData,
    handleReLogin,
    handleStayOffline,
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
      const { default: syncService } = await import('../../../shared/services/storage/sync.js');
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
      
      {/* Token expiration user choice dialog */}
      <TokenExpiredDialog
        isOpen={showTokenExpiredDialog}
        onReLogin={handleReLogin}
        onStayOffline={handleStayOffline}
        hasCachedData={hasCachedData}
      />
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