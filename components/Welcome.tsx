import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { LogOut, Sparkles, User, Shield, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { GoogleGenAI } from '@google/genai';

interface WelcomeProps {
  session: any;
}

export const Welcome: React.FC<WelcomeProps> = ({ session }) => {
  const [username, setUsername] = useState<string>('User');
  const [role, setRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      // Try to get username from metadata
      const metaName = session.user.user_metadata?.username || session.user.user_metadata?.full_name;
      if (metaName) {
        setUsername(metaName);
      } else if (session.user.email) {
        setUsername(session.user.email.split('@')[0]);
      }

      // Get role from metadata
      const metaRole = session.user.user_metadata?.role;
      if (metaRole) {
        setRole(metaRole);
      }
    }
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const generateGreeting = async () => {
    // Support both Vite and standard process.env
    let apiKey: string | undefined;
    
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
      apiKey = (import.meta as any).env.VITE_API_KEY;
    } else if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || process.env.VITE_API_KEY;
    }
    
    if (!apiKey) {
      setAiMessage("Please configure your VITE_API_KEY in Vercel settings.");
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write a short, inspiring, and poetic welcome message for a user named "${username}" who has the role of "${role}". Keep it under 40 words.`,
      });
      setAiMessage(response.text ?? null);
    } catch (err) {
      console.error(err);
      setAiMessage("AI is taking a nap currently. Try again later!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl p-8 md:p-12 rounded-3xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl text-center animate-slide-up relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px]"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]"></div>

      <div className="relative z-10">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <User size={36} className="text-white" />
        </div>

        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 border ${role === 'moderator' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-purple-500/10 border-purple-500/30 text-purple-300'}`}>
          {role === 'moderator' ? <Shield size={12} /> : <Eye size={12} />}
          <span className="uppercase tracking-wider">{role}</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{username}</span>!
        </h1>
        
        <p className="text-gray-300 text-lg mb-8 max-w-lg mx-auto">
          You have successfully logged into the secure portal as a {role}. We're glad to have you here.
        </p>

        {/* AI Section */}
        <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
           {!aiMessage ? (
             <div className="flex flex-col items-center">
                <p className="text-gray-400 mb-4 text-sm">Want a personalized greeting?</p>
                <Button 
                    onClick={generateGreeting} 
                    isLoading={loading}
                    variant="secondary"
                    className="w-auto px-8"
                >
                    <Sparkles size={18} className="text-yellow-400" />
                    Ask AI to say hello
                </Button>
             </div>
           ) : (
             <div className="animate-fade-in">
                 <div className="flex items-center justify-center gap-2 mb-3 text-yellow-400">
                    <Sparkles size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Gemini AI Says</span>
                 </div>
                 <p className="text-lg font-light italic text-white/90 leading-relaxed">"{aiMessage}"</p>
                 <button 
                    onClick={() => setAiMessage(null)}
                    className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                 >
                    Generate another
                 </button>
             </div>
           )}
        </div>

        <Button 
            onClick={handleSignOut} 
            variant="ghost"
            className="w-auto mx-auto text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};