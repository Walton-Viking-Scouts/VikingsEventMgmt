import React from 'react';
import { Toaster } from 'react-hot-toast';
import AppRouter from './routes/AppRouter.jsx';
import './App.css';

/**
 * Main App component for the Viking Event Management mobile application.
 *
 * This is the root component that orchestrates the Scout event management system.
 * It integrates the main routing system with global notification toasts, providing
 * the foundation for offline-first Scout event management and member tracking.
 *
 * The component combines the AppRouter for handling all navigation and the Toaster
 * for displaying user feedback throughout the Scout management workflows.
 *
 * @component
 * @returns {ReactElement} The complete Scout application with routing and notifications
 * @scout-themed
 * @offline-aware
 * @since 1.0.0
 * @example
 * // Basic usage as the root component
 * import App from './App.jsx';
 * 
 * createRoot(document.getElementById('root')).render(
 *   <StrictMode>
 *     <App />
 *   </StrictMode>
 * );
 * @example
 * // Integration with native platforms using Capacitor
 * // The App component automatically handles:
 * // - Offline data synchronization for Scout events
 * // - Member movement tracking between sections
 * // - OSM API integration with rate limiting
 * // - Authentication state management
 * 
 * npx cap sync  // Sync to native platforms
 * @example
 * // Scout management workflow supported:
 * // 1. View and manage Scout sections (Beavers, Cubs, Scouts, etc.)
 * // 2. Track member movements between sections
 * // 3. Manage Scout events and attendance
 * // 4. Handle offline scenarios with cached data
 * // 5. Sync with OSM (Online Scout Manager) when online
 */
function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  );
}

export default App;