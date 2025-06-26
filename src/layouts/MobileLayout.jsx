import React from 'react';
import Header from '../components/Header.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function MobileLayout({ children, user, onLogout }) {
  return (
    <div className="mobile-layout">
      <OfflineIndicator />
      <Header user={user} onLogout={onLogout} />
      
      <main className="mobile-main">
        <div className="mobile-container">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;