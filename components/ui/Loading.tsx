import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center justify-center p-4 animate-fade-in ${className}`}>
    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
  </div>
);

export const LoadingOverlay = ({ message = "Loading..." }: { message?: string }) => (
  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in rounded-[2.5rem]">
     <div className="bg-[#1a1c2e] p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4">
        <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin relative z-10" />
        </div>
        <p className="text-gray-200 text-base font-medium animate-pulse tracking-wide">{message}</p>
     </div>
  </div>
);

export const SkeletonCard = () => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse space-y-4 h-full flex flex-col">
    <div className="flex justify-between items-start">
       <div className="w-20 h-6 bg-white/10 rounded-md"></div>
       <div className="w-24 h-4 bg-white/10 rounded-md"></div>
    </div>
    <div className="w-3/4 h-7 bg-white/10 rounded-md mt-2"></div>
    <div className="space-y-2 mt-2 flex-1">
        <div className="w-full h-4 bg-white/5 rounded"></div>
        <div className="w-2/3 h-4 bg-white/5 rounded"></div>
    </div>
    <div className="flex justify-between items-center pt-4 mt-2 border-t border-white/5">
        <div className="w-20 h-4 bg-white/10 rounded"></div>
        <div className="w-8 h-8 bg-white/10 rounded-full"></div>
    </div>
  </div>
);

export const SkeletonRow = () => (
    <div className="bg-white/5 border border-white/10 p-4 rounded-xl animate-pulse flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 bg-white/10 rounded-full shrink-0"></div>
            <div className="space-y-2 flex-1 max-w-md">
                <div className="w-32 h-4 bg-white/10 rounded"></div>
                <div className="w-24 h-3 bg-white/5 rounded"></div>
            </div>
        </div>
        <div className="w-24 h-8 bg-white/10 rounded-lg shrink-0"></div>
    </div>
);