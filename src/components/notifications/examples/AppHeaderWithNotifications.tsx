import React from 'react';
import { NotificationButton } from '../NotificationButton';

interface AppHeaderWithNotificationsProps {
  appName?: string;
  userInitials?: string;
  userName?: string;
  onProfileClick?: () => void;
  className?: string;
}

/**
 * Example application header component showing how to integrate 
 * the notification system with a typical app layout.
 * 
 * This component demonstrates:
 * - NotificationButton placement in app header
 * - Proper styling and spacing
 * - Integration with user profile
 * - Responsive design considerations
 */
const AppHeaderWithNotifications: React.FC<AppHeaderWithNotificationsProps> = ({
  appName = 'Viking Event Management',
  userInitials = 'JD',
  userName = 'John Doe',
  onProfileClick,
  className = ''
}) => {
  return (
    <header className={`bg-gray-900 text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App branding */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold">{appName}</h1>
            </div>
            
            {/* Navigation - hidden on mobile */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a
                  href="#"
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </a>
                <a
                  href="#"
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Events
                </a>
                <a
                  href="#"
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Members
                </a>
                <a
                  href="#"
                  className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Reports
                </a>
              </div>
            </div>
          </div>

          {/* Right side - Notifications and Profile */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Notification Button */}
              <NotificationButton 
                className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
              />

              {/* Profile dropdown button */}
              <div className="relative">
                <button
                  type="button"
                  className="max-w-xs bg-gray-800 rounded-full flex items-center text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                  onClick={onProfileClick}
                  aria-label={`Profile menu for ${userName}`}
                  aria-haspopup="true"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
                    {userInitials}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu button and notifications */}
          <div className="md:hidden flex items-center space-x-2">
            <NotificationButton 
              className="text-gray-400 hover:text-white"
              showCount={true}
            />
            
            {/* Mobile menu button */}
            <button
              type="button"
              className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - normally would be conditionally shown */}
      <div className="md:hidden hidden" id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-800">
          <a
            href="#"
            className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          >
            Dashboard
          </a>
          <a
            href="#"
            className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          >
            Events
          </a>
          <a
            href="#"
            className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          >
            Members
          </a>
          <a
            href="#"
            className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          >
            Reports
          </a>
        </div>
        <div className="pt-4 pb-3 border-t border-gray-700">
          <div className="flex items-center px-5">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
                {userInitials}
              </div>
            </div>
            <div className="ml-3">
              <div className="text-base font-medium leading-none text-white">{userName}</div>
              <div className="text-sm font-medium leading-none text-gray-400">Profile</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeaderWithNotifications;