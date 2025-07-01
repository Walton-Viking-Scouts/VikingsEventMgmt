import React from 'react';
import DesktopHeader from '../components/desktop/DesktopHeader.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function DesktopLayout({ children, user, onLogout }) {
  return (
    <div className="desktop-layout" data-testid="desktop-layout">
      <OfflineIndicator />
      
      <DesktopHeader 
        user={user} 
        onLogout={onLogout}
      />
      
      <div className="desktop-content">
        <main className="desktop-main full-width" data-testid="desktop-main">
          <div className="desktop-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;