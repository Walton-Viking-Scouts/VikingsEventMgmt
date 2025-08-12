import React from 'react';
import Header from '../components/Header.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function MobileLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="mobile-layout"
    >
      <OfflineIndicator hideSync={true} />
      <Header
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
      />

      {/* Offline banner - positioned below header */}
      {isOfflineMode && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">
                <strong>Offline Mode:</strong> Your authentication has expired,
                but you can still access cached data. Connect to WiFi and
                refresh to re-authenticate with OSM.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1" data-testid="mobile-main">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}

export default MobileLayout;
