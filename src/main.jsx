import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initSentry } from './services/sentry.js';
import { initializeDemoMode } from './config/demoMode.js';

// Initialize Sentry before rendering the app
initSentry();

// Initialize demo mode if enabled
initializeDemoMode();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
