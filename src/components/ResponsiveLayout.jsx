import React from 'react';
import { isMobileLayout } from '../utils/platform.js';
import MobileLayout from '../layouts/MobileLayout.jsx';
import DesktopLayout from '../layouts/DesktopLayout.jsx';

function ResponsiveLayout({ children, user, onLogout }) {
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
    <div data-testid="responsive-layout" className="h-full">
      <LayoutComponent user={user} onLogout={onLogout}>
        {children}
      </LayoutComponent>
    </div>
  );
}

export default ResponsiveLayout;
