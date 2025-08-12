import React from "react";
import DesktopHeader from "../components/desktop/DesktopHeader.jsx";
import OfflineIndicator from "../components/OfflineIndicator.jsx";

function DesktopLayout({
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
      data-testid="desktop-layout"
      data-oid="e44km7p"
    >
      <OfflineIndicator hideSync={false} data-oid="k6wol5r" />

      <DesktopHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="pu76e9g"
      />

      <div className="flex-1" data-oid="4_vcgx8">
        <main
          className="h-full w-full"
          data-testid="desktop-main"
          data-oid="h-xky:d"
        >
          <div
            className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            data-oid="_4o6169"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;
