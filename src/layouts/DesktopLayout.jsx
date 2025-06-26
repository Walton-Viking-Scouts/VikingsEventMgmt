import React from 'react';
import DesktopHeader from '../components/desktop/DesktopHeader.jsx';
import DesktopSidebar from '../components/desktop/DesktopSidebar.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function DesktopLayout({ children, user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="desktop-layout" data-testid="desktop-layout">
      <OfflineIndicator />
      
      <DesktopHeader 
        user={user} 
        onLogout={onLogout}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="desktop-content">
        <DesktopSidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        <main className={`desktop-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`} data-testid="desktop-main">
          <div className="desktop-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DesktopLayout;