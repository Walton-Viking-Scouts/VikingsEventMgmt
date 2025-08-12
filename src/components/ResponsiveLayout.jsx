import React from "react";
import { isMobileLayout } from "../utils/platform.js";
import MobileLayout from "../layouts/MobileLayout.jsx";
import DesktopLayout from "../layouts/DesktopLayout.jsx";

function ResponsiveLayout({
  children,
  user,
  onLogout,
  onLogin,
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
    <div data-testid="responsive-layout" className="h-full" data-oid="y-3ljq5">
      {isOfflineMode && (
        <div
          className="bg-amber-100 border-l-4 border-amber-500 p-4 text-sm"
          data-oid="easusq3"
        >
          <div className="flex" data-oid="16c_jdf">
            <div className="flex-shrink-0" data-oid="l5x3r93">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="exju557"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                  data-oid="lzq8r1b"
                />
              </svg>
            </div>
            <div className="ml-3" data-oid="krkzohk">
              <p className="text-amber-700" data-oid="cv:jfbf">
                <strong data-oid="-83dtnt">Offline Mode:</strong> Your
                authentication has expired, but you can still access cached
                data. Connect to WiFi and refresh to re-authenticate with OSM.
              </p>
            </div>
          </div>
        </div>
      )}
      <LayoutComponent
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        currentView={currentView}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        data-oid="8jj_gwr"
      >
        {children}
      </LayoutComponent>
    </div>
  );
}

export default ResponsiveLayout;
