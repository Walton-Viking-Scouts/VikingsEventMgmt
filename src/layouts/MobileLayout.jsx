import React from "react";
import Header from "../components/Header.jsx";
import OfflineIndicator from "../components/OfflineIndicator.jsx";

function MobileLayout({
  children,
  user,
  onLogout,
  onLogin,
  isOfflineMode,
  authState,
  lastSyncTime,
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="mobile-layout"
      data-oid="wxhc9o-"
    >
      <OfflineIndicator hideSync={false} data-oid="uu2wo47" />
      <Header
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="s7_0dj5"
      />

      <main className="flex-1" data-testid="mobile-main" data-oid="_::vz65">
        <div className="h-full" data-oid="l.s.hxz">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
