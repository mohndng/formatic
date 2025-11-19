import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initializing) {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#1a1c2e] to-[#0f0c29] z-0"></div>
             <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 relative">
                    <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full animate-pulse"></div>
                    <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Formatic</h1>
                    <p className="text-gray-500 text-sm font-medium animate-pulse">Initializing Secure Session...</p>
                </div>
             </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative bg-[#0f0c29] overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#1a1c2e] to-[#0f0c29] z-0"></div>
      
      {/* Ambient Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-700/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse delay-1000"></div>
      
      {/* Content */}
      <div className="relative z-10 w-full flex-1 flex justify-center items-center min-h-0">
        {!session ? (
          <AuthForm />
        ) : (
          <Dashboard session={session} />
        )}
      </div>

      {/* Credits Footer */}
      <div className="relative z-10 mt-5 mb-2 flex flex-col items-center justify-center gap-1.5 animate-fade-in shrink-0 text-center">
         <div className="text-[10px] md:text-[11px] text-gray-500 font-medium tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity duration-300 cursor-default select-none flex items-center gap-1.5">
            Powered by <span className="text-indigo-400 font-bold">Gemini 3.0</span> <span className="text-gray-600">&</span> <span className="text-emerald-400 font-bold">Supabase</span>
         </div>
         <div className="text-[10px] md:text-[11px] text-gray-500 font-medium tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity duration-300 cursor-default select-none">
            Developed by <span className="text-white font-bold">Mon Torneado</span>
         </div>
      </div>
    </div>
  );
}

export default App;