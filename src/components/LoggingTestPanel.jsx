// Test component for demonstrating the logging infrastructure
import React, { useState } from 'react';
import { 
  useComponentLogger, 
  useApiLogger, 
  usePerformanceLogger, 
  useFormLogger, 
  useAuthLogger,
  useLogger,
} from '../hooks/useLogger.js';

function LoggingTestPanel() {
  const [testResults, setTestResults] = useState([]);
  
  // Initialize logging hooks
  const componentLogger = useComponentLogger('LoggingTestPanel', { version: '1.0.0' });
  const apiLogger = useApiLogger();
  const performanceLogger = usePerformanceLogger();
  const formLogger = useFormLogger('test-form');
  const authLogger = useAuthLogger();
  const logger = useLogger({ testPanel: true });
  
  const addResult = (message) => {
    setTestResults(prev => [...prev, { message, timestamp: new Date().toLocaleTimeString() }]);
  };
  
  // Test basic logging
  const testBasicLogging = () => {
    logger.info('Basic logging test executed');
    logger.debug('Debug message with data', { testValue: 42 });
    logger.warn('Warning message test');
    componentLogger.logInfo('Component-specific log message');
    addResult('Basic logging tests executed - check console');
  };
  
  // Test API logging simulation
  const testApiLogging = () => {
    const requestId = apiLogger.logRequest('/api/test-endpoint', { method: 'GET' });
    
    // Simulate successful response
    setTimeout(() => {
      apiLogger.logSuccess('/api/test-endpoint', requestId, { status: 200 }, { data: 'test' });
      addResult('API success logging test completed');
    }, 100);
    
    // Simulate error response
    const errorRequestId = apiLogger.logRequest('/api/error-endpoint', { method: 'POST' });
    setTimeout(() => {
      apiLogger.logError('/api/error-endpoint', errorRequestId, new Error('Simulated API error'));
      addResult('API error logging test completed');
    }, 200);
  };
  
  // Test performance logging
  const testPerformanceLogging = () => {
    performanceLogger.startTiming('test-operation');
    
    // Simulate some work
    setTimeout(() => {
      const duration = performanceLogger.endTiming('test-operation');
      performanceLogger.logMemoryUsage('after test operation');
      addResult(`Performance test completed - duration: ${duration}ms`);
    }, 300);
  };
  
  // Test form logging
  const testFormLogging = () => {
    formLogger.logSubmit({ username: 'test', email: 'test@example.com' });
    formLogger.logValidationError(['Username is required', 'Email format invalid']);
    formLogger.logFieldInteraction('username', 'test-user');
    addResult('Form logging tests completed');
  };
  
  // Test authentication logging
  const testAuthLogging = () => {
    authLogger.logLoginAttempt('oauth');
    setTimeout(() => {
      authLogger.logLoginSuccess('oauth', { id: 'test-user' });
      addResult('Auth logging tests completed');
    }, 100);
  };
  
  // Test user action logging
  const testUserActionLogging = () => {
    componentLogger.logUserAction('button-click', { 
      buttonName: 'test-button',
      timestamp: Date.now(), 
    });
    addResult('User action logging test completed');
  };
  
  // Test error logging
  const testErrorLogging = () => {
    try {
      throw new Error('Test error for logging');
    } catch (error) {
      componentLogger.logError(error, { 
        action: 'testing-error-logging',
        userId: 'test-user', 
      });
      addResult('Error logging test completed');
    }
  };
  
  // Test template literal logging
  const testTemplateLiteralLogging = () => {
    const userId = 'user123';
    const action = 'template-test';
    logger.info`User ${userId} performed action: ${action}`;
    addResult('Template literal logging test completed');
  };
  
  const clearResults = () => {
    setTestResults([]);
  };
  
  // Only show in development
  if (import.meta.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      width: '400px',
      maxHeight: '80vh',
      backgroundColor: 'white',
      border: '2px solid #333',
      borderRadius: '8px',
      padding: '16px',
      zIndex: 10000,
      overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
        📊 Logging Test Panel
      </h3>
      
      <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
        <button onClick={testBasicLogging} style={buttonStyle}>
          🔍 Test Basic Logging
        </button>
        
        <button onClick={testApiLogging} style={buttonStyle}>
          🌐 Test API Logging
        </button>
        
        <button onClick={testPerformanceLogging} style={buttonStyle}>
          ⚡ Test Performance Logging
        </button>
        
        <button onClick={testFormLogging} style={buttonStyle}>
          📝 Test Form Logging
        </button>
        
        <button onClick={testAuthLogging} style={buttonStyle}>
          🔐 Test Auth Logging
        </button>
        
        <button onClick={testUserActionLogging} style={buttonStyle}>
          👆 Test User Action Logging
        </button>
        
        <button onClick={testErrorLogging} style={buttonStyle}>
          ❌ Test Error Logging
        </button>
        
        <button onClick={testTemplateLiteralLogging} style={buttonStyle}>
          📝 Test Template Literals
        </button>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <button onClick={clearResults} style={{...buttonStyle, backgroundColor: '#6c757d'}}>
          🗑️ Clear Results
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        padding: '8px',
        maxHeight: '200px',
        overflow: 'auto',
        fontSize: '12px',
      }}>
        <strong>Test Results:</strong>
        {testResults.length === 0 ? (
          <p style={{ margin: '8px 0', color: '#6c757d' }}>
            No tests run yet. Click buttons above to test logging.
          </p>
        ) : (
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            {testResults.map((result, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                <span style={{ color: '#6c757d' }}>{result.timestamp}</span> - {result.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div style={{ 
        fontSize: '11px', 
        color: '#6c757d', 
        marginTop: '8px',
        padding: '8px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
      }}>
        <strong>💡 Check the browser console for detailed logging output.</strong>
        <br />
        In production, logs are sent to Sentry automatically.
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: '8px 12px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500',
};

export default LoggingTestPanel;
