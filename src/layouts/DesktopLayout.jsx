import React from "react";
import DesktopHeader from "../components/desktop/DesktopHeader.jsx";
import OfflineIndicator from "../components/OfflineIndicator.jsx";

function DesktopLayout({
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
      data-testid="desktop-layout"
      data-oid="h0o9u1m"
    >
      <OfflineIndicator hideBanner={true} data-oid=":1m2f37" />

      <DesktopHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="rixzt:5"
      />

      <div className="flex-1" data-oid="uirtpdz">
        <main
          className="h-full w-full"
          data-testid="desktop-main"
          data-oid="bv:aqd3"
        >
          <div
            className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            data-oid=":bc1w_t"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;
