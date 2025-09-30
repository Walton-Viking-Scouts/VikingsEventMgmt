import React, { useState, useEffect } from 'react';
import {
  WifiIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { NetworkStatus, ConnectionType } from '../../services/network/NetworkStatusManager.js';

const NetworkStatusIndicator = ({
  networkManager,
  showDetails = false,
  className = '',
  size = 'sm',
  position = 'inline',
  onStatusClick = null,
}) => {
  const [networkStatus, setNetworkStatus] = useState({
    status: NetworkStatus.UNKNOWN,
    connectionType: ConnectionType.UNKNOWN,
    connectionQuality: 'unknown',
    connectionDuration: null,
    averageLatency: null,
    backgroundSyncActive: false,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (!networkManager) return;

    const updateStatus = () => {
      setNetworkStatus(networkManager.getDetailedStatus());
    };

    const handleNetworkChange = (eventType, data) => {
      updateStatus();

      if (eventType === 'connection_restored' || eventType === 'connection_lost') {
        setRecentActivity(prev => [...prev.slice(-4), {
          type: eventType,
          timestamp: Date.now(),
          data,
        }]);
      }
    };

    const cleanup = networkManager.addListener(handleNetworkChange);
    updateStatus();

    const intervalId = setInterval(updateStatus, 5000);

    return () => {
      cleanup();
      clearInterval(intervalId);
    };
  }, [networkManager]);

  const getStatusIcon = () => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

    switch (networkStatus.status) {
    case NetworkStatus.ONLINE:
      return networkStatus.connectionType === ConnectionType.WIFI ? (
        <WifiIcon className={`${sizeClass} text-green-500`} />
      ) : (
        <SignalIcon className={`${sizeClass} text-green-500`} />
      );
    case NetworkStatus.OFFLINE:
      return <WifiIcon className={`${sizeClass} text-red-500 opacity-50`} />;
    default:
      return <ExclamationTriangleIcon className={`${sizeClass} text-yellow-500`} />;
    }
  };

  const getStatusColor = () => {
    switch (networkStatus.status) {
    case NetworkStatus.ONLINE:
      return networkStatus.connectionQuality === 'poor' ? 'text-yellow-600' : 'text-green-600';
    case NetworkStatus.OFFLINE:
      return 'text-red-600';
    default:
      return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    if (networkStatus.status === NetworkStatus.OFFLINE) {
      return 'Offline';
    }

    if (networkStatus.status === NetworkStatus.ONLINE) {
      return 'Online';
    }

    return 'Unknown';
  };

  const getQualityIndicator = () => {
    if (networkStatus.status !== NetworkStatus.ONLINE) return null;

    const qualityColors = {
      excellent: 'bg-green-500',
      good: 'bg-green-400',
      fair: 'bg-yellow-400',
      poor: 'bg-red-400',
      unknown: 'bg-gray-400',
    };

    return (
      <div className="flex items-center space-x-1">
        <div className="flex space-x-0.5">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={`w-1 h-3 rounded-sm ${
                getQualityLevel() >= bar
                  ? qualityColors[networkStatus.connectionQuality]
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const getQualityLevel = () => {
    switch (networkStatus.connectionQuality) {
    case 'excellent': return 4;
    case 'good': return 3;
    case 'fair': return 2;
    case 'poor': return 1;
    default: return 0;
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatLatency = (latency) => {
    if (!latency) return 'Unknown';
    return `${latency}ms`;
  };

  const handleClick = () => {
    if (onStatusClick) {
      onStatusClick(networkStatus);
    } else if (showDetails) {
      setIsExpanded(!isExpanded);
    }
  };

  const renderCompactView = () => (
    <div
      className={`flex items-center space-x-2 ${className} ${
        onStatusClick || showDetails ? 'cursor-pointer' : ''
      }`}
      onClick={handleClick}
    >
      {getStatusIcon()}
      {position !== 'icon-only' && (
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      )}
      {showDetails && getQualityIndicator()}
    </div>
  );

  const renderExpandedView = () => (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {networkStatus.status === NetworkStatus.ONLINE && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Connection Quality:</span>
              <div className="flex items-center space-x-2">
                <span className="capitalize">{networkStatus.connectionQuality}</span>
                {getQualityIndicator()}
              </div>
            </div>

            {networkStatus.averageLatency && (
              <div className="flex justify-between">
                <span className="text-gray-600">Latency:</span>
                <span>{formatLatency(networkStatus.averageLatency)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Connected for:</span>
              <span>{formatDuration(networkStatus.connectionDuration)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Background Sync:</span>
              <div className="flex items-center space-x-1">
                {networkStatus.backgroundSyncActive ? (
                  <>
                    <CheckCircleIcon className="w-3 h-3 text-green-500" />
                    <span className="text-green-600">Active</span>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-600">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {networkStatus.status === NetworkStatus.OFFLINE && (
          <div className="flex justify-between">
            <span className="text-gray-600">Offline for:</span>
            <span>{formatDuration(networkStatus.connectionDuration)}</span>
          </div>
        )}

        {recentActivity.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">Recent Activity</h4>
            <div className="space-y-1">
              {recentActivity.slice(-3).map((activity, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs">
                  <ClockIcon className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={
                    activity.type === 'connection_restored' ? 'text-green-600' : 'text-red-600'
                  }>
                    {activity.type === 'connection_restored' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (showDetails && isExpanded) {
    return renderExpandedView();
  }

  return renderCompactView();
};

export const useNetworkStatus = (networkManager) => {
  const [status, setStatus] = useState({
    isOnline: false,
    connectionType: ConnectionType.UNKNOWN,
    connectionQuality: 'unknown',
  });

  useEffect(() => {
    if (!networkManager) return;

    const updateStatus = () => {
      const detailedStatus = networkManager.getDetailedStatus();
      setStatus({
        isOnline: detailedStatus.status === NetworkStatus.ONLINE,
        connectionType: detailedStatus.connectionType,
        connectionQuality: detailedStatus.connectionQuality,
      });
    };

    const cleanup = networkManager.addListener(() => {
      updateStatus();
    });

    updateStatus();

    return cleanup;
  }, [networkManager]);

  return status;
};

export default NetworkStatusIndicator;