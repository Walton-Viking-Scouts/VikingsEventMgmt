import React from 'react';

function Footer() {
  const version = import.meta.env.VITE_APP_VERSION;
  
  return (
    <footer
      className="bg-gray-100 border-t border-gray-200 py-2 px-4 text-center"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="text-xs text-gray-500">
        Viking Event Management v{version}
      </div>
    </footer>
  );
}

export default Footer;