import React from 'react';
import { Alert, Button } from './ui';

function BlockedScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert variant="danger">
          <Alert.Title>
            <div className="flex items-center">
              <svg
                className="w-6 h-6 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Access Blocked
            </div>
          </Alert.Title>
          <Alert.Description className="mt-3">
            OSM API access has been blocked due to rate limiting or other
            restrictions. Please contact the system administrator or try again
            later.
          </Alert.Description>
          <Alert.Actions className="mt-4">
            <Button
              variant="scout-blue"
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </Button>
          </Alert.Actions>
        </Alert>
      </div>
    </div>
  );
}

export default BlockedScreen;
