import React from "react";
import Header from "../components/Header.jsx";
import OfflineIndicator from "../components/OfflineIndicator.jsx";

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
      style={{ touchAction: "pan-y" }}
      data-oid="_qcr_e:"
    >
      <OfflineIndicator data-oid="9xedjt0" />
      <Header
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="h9znxbf"
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: "pan-y" }}
        data-oid=".nm03bj"
      >
        <div className="h-full" data-oid="139j9wh">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
