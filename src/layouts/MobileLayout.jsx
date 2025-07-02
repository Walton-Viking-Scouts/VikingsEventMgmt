import React from 'react';
import Header from '../components/Header.jsx';
import OfflineIndicator from '../components/OfflineIndicator.jsx';

function MobileLayout({ children, user, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="mobile-layout">
      <OfflineIndicator />
      <Header user={user} onLogout={onLogout} />
      
      <main className="flex-1" data-testid="mobile-main">
        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MobileLayout;
