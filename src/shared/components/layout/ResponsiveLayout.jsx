import React from 'react';
import { isMobileLayout } from '../../utils/platform.js';
import MobileLayout from '../../../layouts/MobileLayout.jsx';
import DesktopLayout from '../../../layouts/DesktopLayout.jsx';

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.user
 * @param root0.onLogout
 * @param root0.onLogin
 * @param root0.onRefresh
 * @param root0.currentView
 * @param root0.isOfflineMode
 * @param root0.authState
 * @param root0.lastSyncTime
 */
function ResponsiveLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  currentView,
  isOfflineMode = false,
  authState = 'no_data',
  lastSyncTime = null,
  ...props
}) {
  const [isMobile, setIsMobile] = React.useState(isMobileLayout());

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileLayout());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const LayoutComponent = isMobile ? MobileLayout : DesktopLayout;

  return (
    <div data-testid="responsive-layout" className="h-full" data-oid="z6:bgu7">
      <LayoutComponent
        user={user}
        onLogout={onLogout}
        onLogin={onLogin}
        onRefresh={onRefresh}
        currentView={currentView}
        isOfflineMode={isOfflineMode}
        authState={authState}
        lastSyncTime={lastSyncTime}
        {...props}
      >
        {children}
      </LayoutComponent>
    </div>
  );
}

export default ResponsiveLayout;
