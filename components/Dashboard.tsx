import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { LogOut, Shield, Eye, Layout, AlertTriangle, Fingerprint } from 'lucide-react';
import { Button } from './ui/Button';
import { ModeratorDashboard } from './ModeratorDashboard';
import { ViewerDashboard } from './ViewerDashboard';

interface DashboardProps {
  session: any;
}

export const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const role = session.user.user_metadata?.role || 'viewer';
  const username = session.user.user_metadata?.username || 'User';
  const userId = session.user.id;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const initSession = async () => {
      // Check if we already have a session ID for this browser session to prevent duplicates on refresh
      const storedSessionId = sessionStorage.getItem('formatic_session_id');
      
      if (storedSessionId) {
        setSessionId(storedSessionId);
      } else {
        // Create a new session log in Supabase
        try {
          const { data, error } = await supabase
            .from('user_sessions')
            .insert({
              user_id: userId
            })
            .select()
            .single();

          if (error) throw error;

          if (data) {
            setSessionId(data.id);
            sessionStorage.setItem('formatic_session_id', data.id);
          }
        } catch (err) {
          console.error("Failed to initialize session log:", err);
          // Fallback visual ID if DB fails
          setSessionId(`local-${Math.random().toString(36).substr(2, 9)}`);
        }
      }
    };

    if (userId) {
      initSession();
    }
  }, [userId]);

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmSignOut = async () => {
    setIsLoggingOut(true);
    try {
        // Minimum delay for animation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear local session storage on logout
        sessionStorage.removeItem('formatic_session_id');
        await supabase.auth.signOut();
    } catch (err) {
        console.error("Sign out error:", err);
        setIsLoggingOut(false);
    }
  };

  return (
    <div className="w-full max-w-6xl h-[90vh] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-slide-up">
      {/* Top Navigation Bar */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-white/5 flex-shrink-0">
         <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${role === 'moderator' ? 'bg-indigo-500/20' : 'bg-purple-500/20'}`}>
                <Layout size={24} className={role === 'moderator' ? 'text-indigo-400' : 'text-purple-400'} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white leading-none">Formatic</h1>
                <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">{role} Dashboard</span>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-black/20 rounded-full border border-white/5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center">
                    {role === 'moderator' ? <Shield size={14} className="text-white" /> : <Eye size={14} className="text-white" />}
                </div>
                <span className="text-sm text-gray-200 font-medium pr-2">{username}</span>
            </div>
            <Button variant="ghost" onClick={handleSignOutClick} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 px-3">
                <LogOut size={18} />
            </Button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-4 md:p-8 relative">
         {/* Background decorations */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"></div>
         </div>
         
         <div className="relative z-10 h-full">
            {role === 'moderator' ? (
                <ModeratorDashboard username={username} userId={userId} />
            ) : (
                <ViewerDashboard username={username} />
            )}
         </div>
      </div>

      {/* Footer Session ID */}
      <div className="h-8 bg-black/20 border-t border-white/5 flex items-center justify-center text-[10px] text-gray-600 font-mono tracking-wider select-all">
        <Fingerprint size={10} className="mr-2 opacity-50" />
        SESSION ID: {sessionId || 'INITIALIZING...'}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 rounded-[2.5rem]">
            <div className="bg-[#1a1c2e] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-slide-up">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogOut size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Sign Out?</h3>
                <p className="text-gray-400 mb-6">Are you sure you want to end your session?</p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)} disabled={isLoggingOut}>Cancel</Button>
                    <Button 
                        onClick={confirmSignOut} 
                        isLoading={isLoggingOut}
                        className="bg-red-500 hover:bg-red-600 border-red-500 text-white shadow-red-500/20"
                    >
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};