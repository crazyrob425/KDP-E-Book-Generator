
import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-lg',
  lg: 'w-full max-w-2xl',
  xl: 'w-full max-w-4xl',
};

const Modal: React.FC<ModalProps> = ({ children, onClose, title, size = 'md' }) => {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-800 border border-violet-500/50 rounded-lg shadow-xl max-h-[95vh] overflow-auto ${sizeClasses[size]}`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 pt-5 pb-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
