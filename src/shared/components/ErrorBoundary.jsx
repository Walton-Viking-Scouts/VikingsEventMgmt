import React from 'react';
import ErrorState from './ui/ErrorState.jsx';
import { getScoutFriendlyMessage } from '../utils/scoutErrorHandler.js';
import logger, { LOG_CATEGORIES } from '../services/utils/logger.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, scoutMessage: '' };
  }

  static getDerivedStateFromError(error) {
    const scoutMessage = getScoutFriendlyMessage(error, 'loading the application');
    return { hasError: true, error, scoutMessage };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary caught an error', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorInfo,
      componentStack: errorInfo.componentStack,
    }, LOG_CATEGORIES.ERROR);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full">
            <ErrorState
              message={this.state.scoutMessage}
              onRetry={this.handleRetry}
              retryLabel="Refresh App"
              icon="alert"
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;