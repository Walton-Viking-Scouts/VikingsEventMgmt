/**
 * @file Application entry point for Viking Event Management mobile app.
 *
 * This file initializes the React application with proper error monitoring and
 * Scout-specific configuration. It sets up Sentry error tracking before rendering
 * the main App component, ensuring comprehensive error reporting for Scout leaders
 * managing events and member data.
 *
 * The entry point handles:
 * - Sentry initialization for production error tracking
 * - React StrictMode for development safety
 * - Root DOM element mounting for the Scout management interface
 *
 * @scout-themed Application serves UK Scout Groups with offline-first design
 * @offline-aware Supports cached data when OSM API is unavailable
 * @since 1.0.0
 * @example
 * // This file is automatically executed during app startup
 * // No manual imports needed - handled by build system
 * 
 * // Development server
 * npm run dev
 * 
 * // Production build  
 * npm run build
 * @example
 * // Sentry integration provides:
 * // - Real-time error reporting for Scout leaders
 * // - Performance monitoring for offline operations
 * // - Release tracking for deployment validation
 * // - User context for Scout group identification
 * @example
 * // Entry point enables Scout workflows:
 * // 1. Automatic offline data synchronization
 * // 2. Member movement tracking between sections
 * // 3. Event attendance management
 * // 4. OSM API integration with proper rate limiting
 * // 5. Mobile-optimized interface for Scout leaders
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initSentry } from './shared/services/utils';

// Initialize Sentry before rendering the app
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode data-oid="i-itztv">
    <App data-oid="jnrms1z" />
  </StrictMode>,
);
