import React from 'react';
import * as Sentry from '@sentry/react';
import { Alert } from './ui';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

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

    // Enhanced error context for better debugging
    const errorContext = {
      component: this.props.name || 'Unknown Component',
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      props: this.props.logProps ? JSON.stringify(this.props, null, 2) : undefined,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log error with structured context
    logger.error('React Error Boundary caught error', errorContext, LOG_CATEGORIES.ERROR);

    // Capture in Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', this.props.name || 'ErrorBoundary');
      scope.setTag('component', this.props.name || 'Unknown');
      scope.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
        errorInfo: errorContext,
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // Log retry attempt
    logger.info('Error boundary retry attempted', {
      component: this.props.name || 'Unknown Component',
    }, LOG_CATEGORIES.COMPONENT);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div className="error-boundary-container p-4 max-w-md mx-auto">
          <Alert variant="error" className="mb-4">
            <strong>Something went wrong</strong>
            <p className="mt-2 text-sm">
              {this.props.name ? `Error in ${this.props.name} component` : 'An unexpected error occurred'}
            </p>
            {this.state.error && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">Technical Details</summary>
                <pre className="mt-2 overflow-x-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </Alert>
          
          <div className="flex gap-2">
            <button 
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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
    <ErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;