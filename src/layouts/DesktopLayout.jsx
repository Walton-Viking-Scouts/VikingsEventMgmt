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
      data-oid=":ydynqr"
    >
      <OfflineIndicator hideBanner={true} data-oid="dwen9pm" />

      <DesktopHeader
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="w.z-lr2"
      />

      <div className="flex-1" data-oid="nu26i5b">
        <main
          className="h-full w-full"
          data-testid="desktop-main"
          data-oid="pe5tot2"
        >
          <div
            className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            data-oid="rj1itii"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;
