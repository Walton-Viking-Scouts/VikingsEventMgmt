import React from 'react';
import { useAuth } from '../../auth/hooks';

/**
 * Sign-in prompt shown when the OSM token is missing, expired, or was issued
 * before the finance permission was requested.
 *
 * @returns {JSX.Element} The sign-in card
 */
function SubsSignInCard() {
  const { login } = useAuth();

  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center">
      <p className="text-gray-700 font-medium">Sign in again to see subs</p>
      <p className="mt-1 text-sm text-gray-500">
        Subs needs an OSM session with the finance permission. Your current session either
        expired or was created before that permission was requested, so sign in again to load
        payment data.
      </p>
      <button
        type="button"
        onClick={login}
        className="mt-4 px-4 py-2 rounded-md bg-scout-blue text-white text-sm font-medium hover:bg-scout-blue-dark"
      >
        Sign in to OSM
      </button>
    </div>
  );
}

export default SubsSignInCard;
