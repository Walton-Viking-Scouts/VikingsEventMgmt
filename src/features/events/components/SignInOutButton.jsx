import React from 'react';
import { Button } from '../../../shared/components/ui';

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
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      variant={isSignedIn ? 'outline' : 'primary'}
      size='sm'
    >
      {loading ? 'Processing...' : (isSignedIn ? 'Sign Out' : 'Sign In')}
    </Button>
  );
}

export default SignInOutButton;