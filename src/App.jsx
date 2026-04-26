import React from 'react';
import { Toaster } from 'react-hot-toast';
import AppRouter from './routes/AppRouter.jsx';

// Main App component that integrates the conditional routing system
function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  );
}

export default App;