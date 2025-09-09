import React from 'react';

function Footer() {
  const version = import.meta.env.VITE_APP_VERSION || '2.0.0';
  
  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-2 px-4 text-center">
      <div className="text-xs text-gray-500">
        Viking Event Management v{version}
      </div>
    </footer>
  );
}

export default Footer;