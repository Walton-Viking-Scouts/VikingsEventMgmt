import React from 'react';
import { isMobileLayout } from '../../utils/platform.js';
import VikingHeader from '../VikingHeader.jsx';
import Footer from '../Footer.jsx';

/**
 * Single app layout. Mobile and desktop were previously two near-identical
 * components swapped by an unthrottled resize listener — the only real
 * differences (touch-action and desktop max-width) are handled inline here.
 */
function ResponsiveLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  currentView: _currentView,
  isRefreshing: _isRefreshing,
  isOfflineMode = false,
  authState = 'no_data',
  lastSyncTime = null,
  ...props
}) {
  const isMobile = isMobileLayout();

  return (
    <div data-testid="responsive-layout" className="h-full">
      <div
        className="min-h-screen bg-gray-50 flex flex-col"
        data-testid={isMobile ? 'mobile-layout' : 'desktop-layout'}
        style={isMobile ? { touchAction: 'pan-y' } : undefined}
        {...props}
      >
        <VikingHeader
          user={user}
          onLogout={onLogout}
          onLogin={onLogin}
          onRefresh={onRefresh}
          isOfflineMode={isOfflineMode}
          authState={authState}
          lastSyncTime={lastSyncTime}
        />

        <main
          className="flex-1 overflow-y-auto"
          data-testid={isMobile ? 'mobile-main' : 'desktop-main'}
          style={isMobile ? { touchAction: 'pan-y' } : undefined}
        >
          <div className="h-full sm:max-w-screen-2xl sm:mx-auto sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default ResponsiveLayout;
