import React from "react";
import { Button } from "./ui";

/**
 * AuthButton - Context-aware authentication button for header
 *
 * Displays different button text and behavior based on authentication state:
 * - No data: "Sign in to OSM"
 * - Has cached data: "Refresh data"
 * - Token expired: "Sign in to refresh"
 * - Syncing: "Syncing..." (disabled)
 *
 * @param {Object} props - Component props
 * @param {string} props.authState - Current authentication state
 * @param {Function} props.onLogin - Login handler function
 * @param {Function} props.onRefresh - Refresh handler function
 * @param {boolean} props.isLoading - Whether sync is in progress
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Button size (xs, sm, md, lg, xl)
 */
function AuthButton({
  authState,
  onLogin,
  onRefresh,
  isLoading = false,
  className = "",
  size,
  ...rest
}) {
  const getButtonConfig = () => {
    if (isLoading) {
      return {
        text: "Syncing...",
        onClick: null,
        disabled: true,
        variant: "outline",
      };
    }

    switch (authState) {
      case "no_data":
        return {
          text: "Sign in to OSM",
          onClick: onLogin,
          disabled: false,
          variant: "scout-purple",
        };

      case "cached_only":
        return {
          text: "Refresh data",
          onClick: onRefresh || onLogin, // Prefer onRefresh for cached data
          disabled: false,
          variant: "outline",
        };

      case "token_expired":
        return {
          text: "Sign in to refresh",
          onClick: onLogin,
          disabled: false,
          variant: "scout-purple",
        };

      case "authenticated":
        return {
          text: "Refresh",
          onClick: onRefresh || onLogin,
          disabled: false,
          variant: "outline",
        };

      case "syncing":
        return {
          text: "Syncing...",
          onClick: null,
          disabled: true,
          variant: "outline",
        };

      default:
        return {
          text: "Sign in",
          onClick: onLogin,
          disabled: false,
          variant: "scout-blue",
        };
    }
  };

  const config = getButtonConfig();

  return (
    <Button
      variant={config.variant}
      onClick={config.onClick}
      disabled={config.disabled}
      size={size}
      className={`auth-button ${className}`}
      data-testid="auth-button"
      {...rest}
      data-oid="md0m4qg"
    >
      {config.text}
    </Button>
  );
}

export default AuthButton;
