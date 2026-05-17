// Server component — exports generateStaticParams for static export
import { createClient } from '@supabase/supabase-js';
import ProfileClient from './ProfileClient';

export async function generateStaticParams() {
  try {
    const sb = createClient(
      'https://xhegpgkyivzzdrqjwzoz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZWdwZ2t5aXZ6emRycWp3em96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzMyOTksImV4cCI6MjA5NDQ0OTI5OX0.WGYsGA4_vXrRP_Cl5oLrd2dZ5hcppOQVUszh0KvwW10'
    );
    const { data } = await sb.from('profiles').select('username').not('username', 'is', null);
    return (data || []).map(p => ({ username: p.username }));
  } catch {
    return [];
  }
}

export default function ProfilePage() {
  return <ProfileClient />;
}
