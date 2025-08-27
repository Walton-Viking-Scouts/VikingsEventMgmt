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
      data-oid="ga0iy_w"
    >
      <OfflineIndicator data-oid="3htsjk:" />
      <Header
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="cavmuyl"
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: "pan-y" }}
        data-oid="lyob.ga"
      >
        <div className="h-full" data-oid="h2yor2g">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
