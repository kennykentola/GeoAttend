import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border-l-4 flex justify-between items-start animate-fade-in transition-all ${
              toast.type === 'success' ? 'bg-white border-green-500 text-gray-800' :
              toast.type === 'error' ? 'bg-white border-red-500 text-gray-800' :
              toast.type === 'warning' ? 'bg-white border-yellow-500 text-gray-800' :
              'bg-white border-blue-500 text-gray-800'
            }`}
          >
            <div>
              <h4 className={`font-bold text-sm ${
                 toast.type === 'success' ? 'text-green-600' :
                 toast.type === 'error' ? 'text-red-600' :
                 toast.type === 'warning' ? 'text-yellow-600' :
                 'text-blue-600'
              }`}>
                {toast.type.toUpperCase()}
              </h4>
              <p className="text-sm mt-1">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 ml-4"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};