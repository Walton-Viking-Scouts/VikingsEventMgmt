import React from 'react';

function ToastContainer({ toasts = [], onDismiss = () => {} }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${
            toast.type === 'error' ? 'border-l-4 border-red-500' :
            toast.type === 'success' ? 'border-l-4 border-green-500' :
            toast.type === 'warning' ? 'border-l-4 border-yellow-500' :
            'border-l-4 border-blue-500'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-1">
                {toast.title && (
                  <p className="text-sm font-medium text-gray-900">
                    {toast.title}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="ml-4 flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-md text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;