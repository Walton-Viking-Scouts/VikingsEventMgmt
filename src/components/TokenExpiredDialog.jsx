import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

/**
 * Dialog shown when user's auth token expires, offering choice between re-login or offline mode
 */
function TokenExpiredDialog({ isOpen, onReLogin, onStayOffline, hasCachedData = false }) {
  return (
    <Modal isOpen={isOpen} onClose={null} showCloseButton={false}>
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Session Expired
          </h2>
          <p className="text-gray-600">
            Your authentication session has expired. What would you like to do?
          </p>
        </div>

        {hasCachedData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Good news!</span> You have offline data available. 
              You can continue working offline or sign in again for fresh data.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={onReLogin}
            variant="scout-purple"
            className="w-full"
          >
            Sign in again
          </Button>

          {hasCachedData && (
            <Button
              onClick={onStayOffline}
              variant="outline"
              className="w-full"
            >
              Continue offline
            </Button>
          )}

          {!hasCachedData && (
            <div className="text-sm text-gray-500">
              No offline data available - sign in required to continue
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>• Sign in again: Get fresh data and full functionality</p>
          {hasCachedData && <p>• Continue offline: Use saved data, no fresh updates</p>}
        </div>
      </div>
    </Modal>
  );
}

export default TokenExpiredDialog;