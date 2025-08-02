import React from 'react';
import DesktopHeader from '../components/desktop/DesktopHeader.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function DesktopLayout({ children, user, onLogout, onLogin, _currentView, isOfflineMode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="desktop-layout">
      <OfflineIndicator hideSync={false} />
      
      <DesktopHeader 
        user={user} 
        onLogout={onLogout}
        onLogin={onLogin}
        isOfflineMode={isOfflineMode}
      />
      
      <div className="flex-1">
        <main className="h-full w-full" data-testid="desktop-main">
          <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;
