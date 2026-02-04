import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md w-full space-y-6">
        {(title || showBack) && (
          <div className="flex items-center justify-between mb-6">
            {showBack && (
              <button 
                onClick={onBack}
                className="p-2 rounded-full hover:bg-slate-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            {title && <h1 className="text-2xl font-bold text-slate-900 flex-1 text-center mr-8">{title}</h1>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
