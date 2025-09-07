import React from 'react';
import Header from './ui/Header.jsx';

function AppHeader({
  user,
  onLogout,
  onLogin,
  onRefresh,
  isOfflineMode,
  authState,
  lastSyncTime,
  ...props
}) {
  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Invalid';
    }
  };

  const getStatusText = () => {
    if (isOfflineMode) return 'Offline Mode';
    if (authState === 'authenticated' && user) return `Logged in as ${user.firstname || 'User'}`;
    if (authState === 'no_data') return 'Click "Sign in to OSM" to retrieve data';
    return 'Not authenticated';
  };

  const getStatusColor = () => {
    if (isOfflineMode) return 'text-yellow-200';
    if (authState === 'authenticated' && user) return 'text-green-200';
    return 'text-gray-200';
  };

  return (
    <Header variant="scout" {...props}>
      <Header.Container>
        <Header.Content>
          <Header.Left>
            <Header.Title className="text-xl font-bold text-white">
              Viking Scouts
            </Header.Title>
            {user && (
              <div className="hidden md:block text-sm text-gray-200 ml-4">
                (1st Walton on Thames)
              </div>
            )}
          </Header.Left>

          <Header.Center>
            <div className={`text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </div>
          </Header.Center>

          <Header.Right>
            {lastSyncTime && (
              <div className="hidden sm:block text-xs text-gray-300 mr-4">
                Last sync: {formatLastSync(lastSyncTime)}
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  title="Refresh data from OSM"
                >
                  🔄 Refresh
                </button>
              )}

              {authState === 'authenticated' && user ? (
                <button
                  onClick={onLogout}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={onLogin}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  Sign in to OSM
                </button>
              )}
            </div>
          </Header.Right>
        </Header.Content>
      </Header.Container>
    </Header>
  );
}

export default AppHeader;