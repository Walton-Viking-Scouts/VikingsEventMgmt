import React from 'react';
import DesktopHeader from '../components/desktop/DesktopHeader.jsx';
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
  ...props
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="mobile-layout"
      style={{ touchAction: 'pan-y' }}
      {...props}
    >
      <OfflineIndicator data-oid=":nycp0v" />
      <DesktopHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="t0_96sh"
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: 'pan-y' }}
        data-oid="fo.f5v6"
      >
        <div className="h-full" data-oid="o.r7g:m">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
