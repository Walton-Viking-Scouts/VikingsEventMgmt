import React from 'react';

/**
 *
 * @param root0
 * @param root0.member
 * @param root0.onSignInOut
 * @param root0.loading
 * @param root0.disabled
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