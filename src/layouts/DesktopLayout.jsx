import React from 'react';
import DesktopHeader from '../components/desktop/DesktopHeader.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function DesktopLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
  ...props
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="desktop-layout"
      {...props}
    >
      <OfflineIndicator hideBanner={true} data-oid="vfr2pqb" />

      <DesktopHeader
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
    </div>
  );
}

export default DesktopLayout;
