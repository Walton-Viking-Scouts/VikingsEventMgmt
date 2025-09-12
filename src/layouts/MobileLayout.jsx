import VikingHeader from '../shared/components/VikingHeader.jsx';
import Footer from '../shared/components/Footer.jsx';

/**
 * Mobile-optimized layout container providing header, main content area, and footer
 * 
 * Provides the main application layout structure for mobile devices with Scout-themed
 * styling and touch-optimized interactions. Includes responsive header with authentication
 * controls, scrollable main content area, and persistent footer. Supports offline mode
 * indicators and authentication state management.
 * 
 * @component
 * @param {object} props - Component props object
 * @param {React.ReactNode} props.children - Main content to render in the layout body
 * @param {object|null} props.user - Current authenticated user object with profile information
 * @param {Function} props.onLogout - Callback function to handle user logout actions
 * @param {Function} props.onLogin - Callback function to handle user login actions
 * @param {Function} props.onRefresh - Callback function to handle data refresh requests
 * @param {boolean} props.isOfflineMode - Whether the application is currently in offline mode
 * @param {string} props.authState - Current authentication state: 'loading', 'authenticated', 'unauthenticated'
 * @param {string|null} props.lastSyncTime - ISO timestamp of last successful data synchronization
 * 
 * @returns {JSX.Element} Rendered mobile layout with header, main content, and footer sections
 * 
 * @example
 * // Basic mobile layout usage
 * <MobileLayout
 *   user={currentUser}
 *   onLogout={handleLogout}
 *   onLogin={handleLogin}
 *   onRefresh={handleRefresh}
 *   isOfflineMode={false}
 *   authState="authenticated"
 *   lastSyncTime="2025-09-12T10:30:00Z"
 * >
 *   <EventListPage />
 * </MobileLayout>
 * 
 * @example
 * // Offline mode with cached data
 * <MobileLayout
 *   user={cachedUser}
 *   onLogout={handleLogout}
 *   onLogin={() => notifyInfo('Login available when online')}
 *   onRefresh={handleCacheRefresh}
 *   isOfflineMode={true}
 *   authState="authenticated"
 *   lastSyncTime="2025-09-12T09:15:00Z"
 *   className="bg-gray-100"
 * >
 *   <div className="p-4">
 *     <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
 *       <span className="text-amber-800">Offline mode - showing cached data</span>
 *     </div>
 *     <SectionDashboard />
 *   </div>
 * </MobileLayout>
 * 
 * @example
 * // Loading state during authentication
 * <MobileLayout
 *   user={null}
 *   onLogout={() => {}}
 *   onLogin={handleLogin}
 *   onRefresh={handleRefresh}
 *   isOfflineMode={false}
 *   authState="loading"
 *   lastSyncTime={null}
 * >
 *   <LoadingScreen message="Authenticating..." />
 * </MobileLayout>
 * 
 * @since 2.5.0
 * @example
 * // Scout-themed styling integration
 * // Uses Scout color scheme with header styling and responsive design
 * // Displays offline indicators and manages cached content presentation
 */
function MobileLayout({
  children,
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
  ...props
}) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      data-testid="mobile-layout"
      style={{ touchAction: 'pan-y' }}
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
        data-oid="t0_96sh"
      />

      <main
        className="flex-1 overflow-y-auto"
        data-testid="mobile-main"
        style={{ touchAction: 'pan-y' }}
        data-oid="fo.f5v6"
      >
        <div className="h-full" data-oid="o.r7g:m">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

export default MobileLayout;
