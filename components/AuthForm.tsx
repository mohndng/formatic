
import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Check, AlertCircle, Shield, Eye, ArrowLeft } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [role, setRole] = useState<'moderator' | 'viewer'>('viewer');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null); // Clear errors on type
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: window.location.origin, 
      });
      if (error) throw error;
      setSuccessMessage("Password reset link sent to your email!");
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username,
              role: role,
            },
          },
        });
        if (signUpError) throw signUpError;
        setSuccessMessage("Account created! Please check your email to confirm your account.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-3xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
          Formatic
        </h1>
        <h2 className="text-xl font-semibold text-white mb-1">
          {isResettingPassword ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Smart Assessment Platform')}
        </h2>
        <p className="text-gray-400 text-sm">
          {isResettingPassword 
            ? 'Enter your email to receive a reset link' 
            : (isSignUp ? 'Join to create or take forms' : 'Create, share, and analyze forms with AI power.')}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-200 text-sm animate-fade-in">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-200 text-sm animate-fade-in">
          <Check size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={isResettingPassword ? handleResetPassword : handleAuth} className="space-y-5">
        {isSignUp && !isResettingPassword && (
          <>
            <Input
              name="username"
              placeholder="Username"
              icon={<User size={18} />}
              value={formData.username}
              onChange={handleChange}
              required
              label="Username"
            />
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-200 ml-1">Select Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('moderator')}
                  className={`p-3 rounded-xl border flex flex-row items-center justify-center gap-2 transition-all duration-200 group ${
                    role === 'moderator' 
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <Shield size={16} className={role === 'moderator' ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'} />
                  <span className="text-sm font-medium">Moderator</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('viewer')}
                  className={`p-3 rounded-xl border flex flex-row items-center justify-center gap-2 transition-all duration-200 group ${
                    role === 'viewer' 
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <Eye size={16} className={role === 'viewer' ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'} />
                  <span className="text-sm font-medium">Viewer</span>
                </button>
              </div>
            </div>
          </>
        )}
        
        <Input
          name="email"
          type="email"
          placeholder="name@example.com"
          icon={<Mail size={18} />}
          value={formData.email}
          onChange={handleChange}
          required
          label="Email"
        />

        {!isResettingPassword && (
          <div>
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              icon={<Lock size={18} />}
              value={formData.password}
              onChange={handleChange}
              required
              label="Password"
            />
            {!isSignUp && (
              <div className="flex items-center justify-between mt-3 text-sm">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                  <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${rememberMe ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600 bg-transparent'}`}>
                    {rememberMe && <Check size={12} className="text-white" />}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={rememberMe} 
                      onChange={() => setRememberMe(!rememberMe)} 
                    />
                  </div>
                  Remember me
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    setIsResettingPassword(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="mt-2" isLoading={loading}>
          {isResettingPassword ? 'Send Reset Link' : (isSignUp ? 'Sign Up' : 'Sign In')} 
          <ArrowRight size={18} />
        </Button>
      </form>

      <div className="mt-8 text-center">
        {isResettingPassword ? (
          <button 
            type="button"
            onClick={() => {
              setIsResettingPassword(false);
              setError(null);
              setSuccessMessage(null);
            }}
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors mx-auto text-sm"
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>
        ) : (
          <p className="text-gray-400 text-sm">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-white font-medium hover:underline focus:outline-none"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
