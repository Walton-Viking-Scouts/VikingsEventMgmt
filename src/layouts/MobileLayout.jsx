import React from 'react';
import VikingHeader from '../shared/components/VikingHeader.jsx';
import Footer from '../shared/components/Footer.jsx';

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
      <VikingHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="h-full">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

export default MobileLayout;
