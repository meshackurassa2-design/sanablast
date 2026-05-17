// Server component wrapper — exports generateStaticParams for static export
import { createClient } from '@supabase/supabase-js';
import StatusClient from './StatusClient';

export async function generateStaticParams() {
  try {
    const sb = createClient(
      'https://xhegpgkyivzzdrqjwzoz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZWdwZ2t5aXZ6emRycWp3em96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzMyOTksImV4cCI6MjA5NDQ0OTI5OX0.WGYsGA4_vXrRP_Cl5oLrd2dZ5hcppOQVUszh0KvwW10'
    );
    const [{ data: profiles }, { data: blasts }] = await Promise.all([
      sb.from('profiles').select('id, username').not('username', 'is', null),
      sb.from('blasts').select('id, user_id'),
    ]);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p.username; });
    return (blasts || []).map(b => ({ username: profileMap[b.user_id] || 'user', id: String(b.id) }));
  } catch {
    return [];
  }
}

export default function StatusPage() {
  return <StatusClient />;
}
