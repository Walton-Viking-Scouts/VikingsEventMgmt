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
 */
function AuthButton({
  authState,
  onLogin,
  onRefresh,
  isLoading = false,
  className = "",
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
          variant: "scout-blue",
        };

      case "cached_only":
        return {
          text: "Refresh data",
          onClick: onLogin, // Login to get fresh data
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
      className={`auth-button ${className}`}
      data-testid="auth-button"
      data-oid="2at8sbp"
    >
      {config.text}
    </Button>
  );
}

export default AuthButton;
