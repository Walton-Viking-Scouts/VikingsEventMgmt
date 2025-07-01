// Test component for Sentry integration - for development only
import React from 'react';
import * as Sentry from '@sentry/react';
import { sentryUtils, logger } from '../services/sentry.js';

function SentryTestButton() {
  const handleTestButtonClick = () => {
    // Create a transaction/span to measure performance
    Sentry.startSpan(
      {
        op: 'ui.click',
        name: 'Test Button Click',
      },
      (span) => {
        const value = 'test config';
        const metric = Math.random();

        // Metrics can be added to the span
        span.setAttribute('config', value);
        span.setAttribute('metric', metric);

        // Test various Sentry features
        logger.info('Test button clicked', { metric, timestamp: Date.now() });
        
        sentryUtils.addBreadcrumb({
          message: 'User clicked test button',
          level: 'info',
          data: { metric, value },
        });

        console.log('Sentry test executed successfully!');
      },
    );
  };

  const handleErrorTest = () => {
    try {
      // Intentionally cause an error for testing
      throw new Error('This is a test error for Sentry');
    } catch (error) {
      sentryUtils.captureException(error, {
        test: {
          type: 'intentional_error',
          component: 'SentryTestButton',
        },
      });
      
      console.log('Test error captured by Sentry');
    }
  };

  // Only show in development
  if (import.meta.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <button 
        type="button" 
        onClick={handleTestButtonClick}
        style={{
          padding: '10px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Test Sentry Span
      </button>
      
      <button 
        type="button" 
        onClick={handleErrorTest}
        style={{
          padding: '10px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Test Sentry Error
      </button>
    </div>
  );
}

export default SentryTestButton;
