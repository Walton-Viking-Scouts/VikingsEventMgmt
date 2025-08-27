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
      data-oid="h:0r24u"
    >
      <OfflineIndicator data-oid="fm0:5-f" />
      <Header
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="2e7qly7"
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: "pan-y" }}
        data-oid="y7hpes7"
      >
        <div className="h-full" data-oid="dlhud7r">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
