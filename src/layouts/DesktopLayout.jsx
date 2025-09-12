import React from 'react';
import VikingHeader from '../shared/components/VikingHeader.jsx';
import Footer from '../shared/components/Footer.jsx';

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.user
 * @param root0.onLogout
 * @param root0.onLogin
 * @param root0.onRefresh
 * @param root0.isOfflineMode
 * @param root0.authState
 * @param root0.lastSyncTime
 * @param root0.currentView
 * @param root0.isRefreshing
 */
function DesktopLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
  currentView: _currentView,
  isRefreshing: _isRefreshing,
  ...props
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="desktop-layout"
      {...props}
    >

      <VikingHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="zesdbg9"
      />

      <div className="flex-1" data-oid="38t5gt4">
        <main
          className="h-full w-full"
          data-testid="desktop-main"
          data-oid="vw9-bd4"
        >
          <div
            className="h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8"
            data-oid="e.t3iu6"
          >
            {children}
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
}

export default DesktopLayout;
