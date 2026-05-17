import { createClient } from '@supabase/supabase-js';

// Hardcode fallbacks for mobile build in case env vars don't inject properly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xhegpgkyivzzdrqjwzoz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZWdwZ2t5aXZ6emRycWp3em96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzMyOTksImV4cCI6MjA5NDQ0OTI5OX0.WGYsGA4_vXrRP_Cl5oLrd2dZ5hcppOQVUszh0KvwW10';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Turn off for mobile unless using deep links
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
