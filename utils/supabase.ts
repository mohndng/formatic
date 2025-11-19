import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in browser or Node environments
const getEnv = (key: string) => {
  // Check for Vite environment variables
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // Check for standard process.env (Node/Legacy)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// In production (Vercel), we use VITE_ prefixed variables
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || "https://epirklugbcwpqxxmxcan.supabase.co";
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaXJrbHVnYmN3cHF4eG14Y2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NTcyMDksImV4cCI6MjA3OTEzMzIwOX0.Bu6AUksQRBG0176O44aJeqsY2dSx8Xbq7irH-9HVnQw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);