import React from 'react';
import { AlertAdapter } from '../adapters';
import { Button } from './ui';

function BlockedScreen() {
  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
      data-oid="y26.-o5"
    >
      <div className="max-w-md w-full" data-oid="5vt_1du">
        <AlertAdapter variant="error" data-oid="yva4rk2">
          <AlertAdapter.Title data-oid="f7jkoto">
            <div className="flex items-center" data-oid="q6i9yc.">
              <svg
                className="w-6 h-6 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="tbrww-_"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                  data-oid="_ksvt3q"
                />
              </svg>
              Access Blocked
            </div>
          </AlertAdapter.Title>
          <AlertAdapter.Description className="mt-3" data-oid="2in8wg1">
            OSM API access has been blocked due to rate limiting or other
            restrictions. Please contact the system administrator or try again
            later.
          </AlertAdapter.Description>
          <AlertAdapter.Actions className="mt-4" data-oid="cu8cly3">
            <Button
              variant="scout-blue"
              onClick={() => window.location.reload()}
              type="button"
              data-oid="06bdaoo"
            >
              Retry
            </Button>
          </AlertAdapter.Actions>
        </AlertAdapter>
      </div>
    </div>
  );
}

export default BlockedScreen;
