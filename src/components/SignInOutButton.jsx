import React from "react";

/**
 * SignInOutButton - Handles sign in/out actions for camp attendance
 *
 * @param {Object} props - Component props
 * @param {Object} props.member - Member data with vikingEventData
 * @param {Function} props.onSignInOut - Callback function for sign in/out action
 * @param {boolean} props.loading - Loading state for this specific button
 */
function SignInOutButton({ member, onSignInOut, loading }) {
  const isSignedIn =
    member.vikingEventData?.SignedInBy &&
    member.vikingEventData?.SignedInBy !== "-" &&
    member.vikingEventData?.SignedInBy.trim() !== "";
  const isSignedOut =
    member.vikingEventData?.SignedOutBy &&
    member.vikingEventData?.SignedOutBy !== "-" &&
    member.vikingEventData?.SignedOutBy.trim() !== "";

  // Show Sign In if not signed in, Sign Out if signed in but not signed out
  const action = isSignedIn && !isSignedOut ? "signout" : "signin";
  const label = action === "signin" ? "Sign In" : "Sign Out";

  // Use pill-style button like existing filter buttons
  const baseStyles =
    "px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 hover:shadow-sm min-w-16";
  const activeStyles =
    action === "signin"
      ? "bg-scout-green text-white hover:bg-scout-green-dark"
      : "bg-scout-red text-white hover:bg-scout-red-dark";

  return (
    <button
      onClick={() => onSignInOut(member, action)}
      disabled={loading}
      className={`${baseStyles} ${activeStyles} ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      type="button"
      title={`${label} ${member.name}`}
      data-oid="ggmkejp"
    >
      {loading ? "..." : label}
    </button>
  );
}

export default SignInOutButton;
