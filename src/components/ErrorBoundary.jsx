import React from "react";
import * as Sentry from "@sentry/react";
import { Alert } from "./ui";
import logger, { LOG_CATEGORIES } from "../services/logger.js";

// Shared configuration for sensitive data patterns
const SENSITIVE_PATTERNS = {
  // Sensitive key patterns for prop redaction
  PROP_KEYS: ["token", "password", "secret", "key", "auth", "credential"],
  // Sensitive URL parameter patterns
  URL_PARAMS: [
    "access_token",
    "id_token",
    "refresh_token",
    "token",
    "api_key",
    "apikey",
    "key",
    "secret",
    "auth",
    "authorization",
    "session",
    "session_id",
  ],
};

// Enhanced Sentry ErrorBoundary with custom fallback and security features
export const EnhancedSentryErrorBoundary = ({
  children,
  name,
  fallback,
  logProps,
}) => {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        // Log error with our enhanced context (same as custom boundary)
        const errorContext = {
          component: name || "Unknown Component",
          errorMessage: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
          userAgent:
            typeof navigator !== "undefined"
              ? navigator.userAgent
              : "Server Side",
        };

        logger.error(
          "React Error Boundary caught error",
          errorContext,
          LOG_CATEGORIES.ERROR,
        );

        // Use custom fallback if provided
        if (fallback) {
          return fallback(error, resetError);
        }

        // Default enhanced fallback UI
        return (
          <div
            className="error-boundary-container p-4 max-w-md mx-auto"
            data-oid="2bwt:-0"
          >
            <Alert variant="error" className="mb-4" data-oid="1vjl_8:">
              <strong data-oid="g8v_fv_">Something went wrong</strong>
              <p className="mt-2 text-sm" data-oid="w6xl2sh">
                {name
                  ? `Error in ${name} component`
                  : "An unexpected error occurred"}
              </p>
              <details className="mt-2 text-xs" data-oid="4gkhv2-">
                <summary className="cursor-pointer" data-oid="2gexhxv">
                  Technical Details
                </summary>
                <pre className="mt-2 overflow-x-auto" data-oid=":eav1yo">
                  {error.message}
                </pre>
              </details>
            </Alert>

            <div className="flex gap-2" data-oid="3qp4jv6">
              <button
                onClick={resetError}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                data-oid="aynx0ak"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                data-oid="oda7mod"
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }}
      beforeCapture={(scope, error, errorInfo) => {
        // Enhanced context setting with security features
        scope.setTag("errorBoundary", name || "ErrorBoundary");
        scope.setTag("component", name || "Unknown");
        scope.setContext("errorBoundary", {
          componentStack: errorInfo.componentStack,
          component: name || "Unknown Component",
          hasProps: !!logProps,
          timestamp: new Date().toISOString(),
        });
        scope.setLevel("error");
      }}
      data-oid="ovat1gw"
    >
      {children}
    </Sentry.ErrorBoundary>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Safe serializer for props to handle circular references and redact sensitive data
    const safeSerialize = (obj, maxDepth = 3, currentDepth = 0) => {
      if (currentDepth >= maxDepth) return "[Max Depth Reached]";
      if (obj === null || obj === undefined) return obj; // null or undefined
      const t = typeof obj;
      if (t === "function") return "[Function]";
      if (t === "symbol") return "[Symbol]";
      if (t === "bigint") return "[BigInt]";
      if (t !== "object") return obj;
      if (obj instanceof Date) return obj.toISOString();
      if (Array.isArray(obj)) {
        return obj
          .slice(0, 50)
          .map((v) => safeSerialize(v, maxDepth, currentDepth + 1));
      }
      try {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          // Skip heavy/noisy keys
          if (key === "children" || key === "fallback") {
            result[key] = "[Skipped]";
            continue;
          }
          // Redact sensitive keys (substring match, case-insensitive)
          if (
            SENSITIVE_PATTERNS.PROP_KEYS.some((s) =>
              key.toLowerCase().includes(s),
            )
          ) {
            result[key] = "[REDACTED]";
          } else if (typeof value === "function") {
            result[key] = "[Function]";
          } else if (value && typeof value === "object") {
            result[key] = safeSerialize(value, maxDepth, currentDepth + 1);
          } else {
            result[key] = value;
          }
        }
        return result;
      } catch {
        return "[Serialization Error]";
      }
    };

    // Redact sensitive query parameters from URL
    const redactSensitiveUrl = (url) => {
      if (!url) return "[URL Not Available]";
      try {
        const urlObj = new URL(url);
        const sensitives = SENSITIVE_PATTERNS.URL_PARAMS;

        // Case-insensitive match, redact any param whose name includes a sensitive token
        for (const [k] of urlObj.searchParams.entries()) {
          if (sensitives.some((s) => k.toLowerCase().includes(s))) {
            urlObj.searchParams.set(k, "[REDACTED]");
          }
        }
        return urlObj.toString();
      } catch {
        return "[Invalid URL]";
      }
    };

    // Enhanced error context with SSR safety and security
    const errorContext = {
      component: this.props.name || "Unknown Component",
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      props: this.props.logProps ? safeSerialize(this.props) : undefined,
      timestamp: new Date().toISOString(),
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "Server Side",
      url:
        typeof window !== "undefined"
          ? redactSensitiveUrl(window.location.href)
          : "Server Side",
    };

    // Log error with structured context
    logger.error(
      "React Error Boundary caught error",
      errorContext,
      LOG_CATEGORIES.ERROR,
    );

    // Capture in Sentry with enhanced context using React-specific capture
    Sentry.withScope((scope) => {
      scope.setTag("errorBoundary", this.props.name || "ErrorBoundary");
      scope.setTag("component", this.props.name || "Unknown");
      scope.setContext("errorBoundary", {
        componentStack: errorInfo.componentStack,
        errorInfo: errorContext,
      });
      scope.setLevel("error");
      // Use captureException with React component stack already attached via scope
      Sentry.captureException(error);
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });

    // Log retry attempt
    logger.info(
      "Error boundary retry attempted",
      {
        component: this.props.name || "Unknown Component",
      },
      LOG_CATEGORIES.COMPONENT,
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div
          className="error-boundary-container p-4 max-w-md mx-auto"
          data-oid="n5igf3d"
        >
          <Alert variant="error" className="mb-4" data-oid="bftttgs">
            <strong data-oid="ulneti1">Something went wrong</strong>
            <p className="mt-2 text-sm" data-oid="s0w32kg">
              {this.props.name
                ? `Error in ${this.props.name} component`
                : "An unexpected error occurred"}
            </p>
            {this.state.error && (
              <details className="mt-2 text-xs" data-oid="y_51fez">
                <summary className="cursor-pointer" data-oid="bsg9v98">
                  Technical Details
                </summary>
                <pre className="mt-2 overflow-x-auto" data-oid="zunubi_">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </Alert>

          <div className="flex gap-2" data-oid="ydg8in3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              data-oid="pk4-10k"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              data-oid="f.fsj5j"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy wrapping of components
export const withErrorBoundary = (Component, boundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...boundaryProps} data-oid="8c5gxwd">
      <Component {...props} data-oid="xcn774s" />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
};

// Keep legacy custom ErrorBoundary for specific use cases
export { ErrorBoundary as CustomErrorBoundary };

// Export Enhanced Sentry ErrorBoundary as default (recommended)
export default EnhancedSentryErrorBoundary;
