import React from 'react';

/**
 * Scout sign-in/out toggle button for event attendance management.
 * Dynamically displays appropriate action based on current Scout attendance status
 * with Scout-themed styling and comprehensive interaction feedback.
 * 
 * @param {object} root0 - Scout attendance toggle configuration and interaction handlers
 * @param {object} root0.member - Scout member data containing attendance status and identification
 * @param {Function} root0.onSignInOut - Handler triggered when Scout sign-in/out action is requested
 * @param {boolean} root0.loading - Flag indicating whether sign-in/out operation is currently processing
 * @param {boolean} root0.disabled - Flag to disable button interaction during critical operations
 * @returns {JSX.Element} Scout-themed toggle button for event attendance management
 */
function SignInOutButton({ 
  member, 
  onSignInOut, 
  loading,
  disabled,
}) {
  const isSignedIn = member.isSignedIn;

  const handleClick = () => {
    const action = isSignedIn ? 'signout' : 'signin';
    onSignInOut(member, action);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md font-medium px-3 py-1.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        isSignedIn
          ? 'bg-error text-white hover:bg-red-600 focus:ring-red-300 active:bg-red-700'
          : 'bg-scout-green text-white hover:bg-scout-green-dark focus:ring-scout-green-light active:bg-scout-green-dark'
      }`}
    >
      {loading ? 'Processing...' : (isSignedIn ? 'Sign Out' : 'Sign In')}
    </button>
  );
}

export default SignInOutButton;