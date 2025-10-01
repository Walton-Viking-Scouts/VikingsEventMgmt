import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initSentry } from './shared/services/utils';
import { AuthProvider } from './features/auth/hooks';

// Initialize Sentry before rendering the app
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode data-oid="i-itztv">
    <AuthProvider>
      <App data-oid="jnrms1z" />
    </AuthProvider>
  </StrictMode>,
);
