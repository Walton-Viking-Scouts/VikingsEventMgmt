import React from "react";
import * as Sentry from "@sentry/react";
import { Button, Card } from "./ui";

function LoginScreen({ onLogin }) {
  const handleLoginClick = () => {
    // Log login attempt for monitoring (without span to avoid OAuth interference)
    Sentry.addBreadcrumb({
      category: "auth",
      message: "User initiated OAuth login",
      level: "info",
      data: {
        component: "LoginScreen",
        action: "login_button_clicked",
        timestamp: new Date().toISOString(),
      },
    });

    // Direct login call without span instrumentation to prevent OAuth interference
    onLogin();
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 bg-gray-50"
      data-testid="login-screen"
      data-oid="zkc1tso"
    >
      <Card className="w-full max-w-md" data-oid="cuff2yk">
        <Card.Body className="p-8 text-center" data-oid="sbwss67">
          <h1
            className="text-2xl font-bold text-gray-900 mb-4"
            data-oid="hf21-p."
          >
            Vikings Event Management
          </h1>
          <p className="text-gray-600 mb-6" data-oid="xzb3qti">
            Please log in with your Online Scout Manager account to continue.
          </p>
          <Button
            variant="scout-purple"
            size="lg"
            onClick={handleLoginClick}
            className="w-full"
            data-testid="login-button"
            data-oid="whyjk0w"
          >
            Login with Online Scout Manager (OSM)
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}

export default LoginScreen;
