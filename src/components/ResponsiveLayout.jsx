import React from "react";
import { isMobileLayout } from "../utils/platform.js";
import MobileLayout from "../layouts/MobileLayout.jsx";
import DesktopLayout from "../layouts/DesktopLayout.jsx";

function ResponsiveLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  currentView,
  isOfflineMode = false,
  authState = "no_data",
  lastSyncTime = null,
}) {
  const [isMobile, setIsMobile] = React.useState(isMobileLayout());

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileLayout());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const LayoutComponent = isMobile ? MobileLayout : DesktopLayout;

  return (
    <div data-testid="responsive-layout" className="h-full" data-oid=":4z4d:q">
      <LayoutComponent
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        currentView={currentView}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="7vr:75l"
      >
        {children}
      </LayoutComponent>
    </div>
  );
}

export default ResponsiveLayout;
