import VikingHeader from '../shared/components/VikingHeader.jsx';
import Footer from '../shared/components/Footer.jsx';

/**
 * Desktop layout wrapper component for Viking Event Management Scout application.
 * Provides desktop-optimized interface with horizontal navigation and Scout-themed styling.
 * Supports offline-first design with cached data display and authentication management.
 * Optimized for larger screens with full-width content area and professional layout.
 * 
 * @component
 * @since 1.0.0
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render in main content area
 * @param {object|null} props.user - Current authenticated user object with profile data
 * @param {Function} props.onLogout - Callback function to handle user logout process
 * @param {Function} props.onLogin - Callback function to handle user login process
 * @param {Function} props.onRefresh - Callback function to handle data refresh/sync operations
 * @param {boolean} props.isOfflineMode - Flag indicating offline mode status for UI feedback
 * @param {string} props.authState - Current authentication state (authenticated, unauthenticated, loading)
 * @param {string|Date|null} props.lastSyncTime - Timestamp of last successful data synchronization
 * @param {string} props.currentView - Current active view identifier (unused in desktop layout)
 * @param {boolean} props.isRefreshing - Flag indicating active refresh/sync operation (unused in desktop layout)
 * @returns {JSX.Element} Desktop layout with header navigation and Scout branding
 * 
 * @example
 * // Basic desktop layout for Scout leaders
 * <DesktopLayout
 *   user={scoutLeader}
 *   onLogout={handleLogout}
 *   onLogin={handleLogin}
 *   onRefresh={handleRefresh}
 *   isOfflineMode={false}
 *   authState="authenticated"
 *   lastSyncTime="2024-01-15T10:30:00Z"
 * >
 *   <EventDashboard />
 * </DesktopLayout>
 * 
 * @example
 * // Desktop layout with offline mode
 * <DesktopLayout
 *   user={null}
 *   onLogout={handleLogout}
 *   onLogin={handleLogin}
 *   onRefresh={handleRefresh}
 *   isOfflineMode={true}
 *   authState="unauthenticated"
 *   lastSyncTime={null}
 *   currentView="events"
 *   isRefreshing={false}
 * >
 *   <OfflineModeMessage />
 *   <CachedEventsList />
 * </DesktopLayout>
 */
function DesktopLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
  currentView: _currentView,
  isRefreshing: _isRefreshing,
  ...props
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="desktop-layout"
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
        data-oid="zesdbg9"
      />

      <div className="flex-1" data-oid="38t5gt4">
        <main
          className="h-full w-full"
          data-testid="desktop-main"
          data-oid="vw9-bd4"
        >
          <div
            className="h-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8"
            data-oid="e.t3iu6"
          >
            {children}
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
}

export default DesktopLayout;
