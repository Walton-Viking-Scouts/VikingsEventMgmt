import React from 'react';
import { Toaster } from 'react-hot-toast';
import AppRouter from './routes/AppRouter.jsx';

// Main App component that integrates the conditional routing system
function App() {
  return (
    <>
      <AppRouter />
      <Toaster
        containerStyle={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
      />
    </>
  );
}

export default App;