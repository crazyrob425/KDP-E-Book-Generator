
import React from 'react';

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg', message?: string }> = ({ size = 'md', message }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className={`${sizeClasses[size]} border-4 border-slate-500 border-t-violet-500 rounded-full animate-spin`}></div>
      {message && <p className="text-lg animate-pulse">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
