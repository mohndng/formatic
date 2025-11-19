import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium text-gray-200 ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-400 transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`w-full bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};