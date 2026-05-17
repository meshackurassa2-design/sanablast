const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xhegpgkyivzzdrqjwzoz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZWdwZ2t5aXZ6emRycWp3em96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzMyOTksImV4cCI6MjA5NDQ0OTI5OX0.WGYsGA4_vXrRP_Cl5oLrd2dZ5hcppOQVUszh0KvwW10';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZWdwZ2t5aXZ6emRycWp3em96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg3MzI5OSwiZXhwIjoyMDk0NDQ5Mjk5fQ._w5LE7FwR2w9jpIWTCCcF0or-upMNd2wwAkIC6qI270';

// Use service role to bypass RLS for reading messages
const supabase = createClient(supabaseUrl, serviceKey);

const dapazId = '0e5dc279-52cb-4d2a-a877-f5d846c100e6';
const joshanId = '6781cdf1-e066-4374-836f-2c00399b1420';

async function run() {
  // Read messages using service role (bypasses RLS like the browser does with JWT)
  const [sent, received] = await Promise.all([
    supabase.from('messages').select('*').eq('sender_id', dapazId).order('created_at', { ascending: false }),
    supabase.from('messages').select('*').eq('receiver_id', dapazId).order('created_at', { ascending: false }),
  ]);
  console.log('sent count:', sent.data?.length);
  console.log('received count:', received.data?.length);

  const all = [...(sent.data || []), ...(received.data || [])];
  
  const seen = new Set();
  const deduped = [];
  all.forEach(msg => {
    const otherId = msg.sender_id === dapazId ? msg.receiver_id : msg.sender_id;
    if (!otherId || seen.has(otherId)) return;
    seen.add(otherId);
    deduped.push({ otherId, lastMsg: msg });
  });

  console.log('\nThread other IDs:', deduped.map(d => d.otherId));

  // Now fetch profiles
  const otherIds = deduped.map(d => d.otherId);
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, full_name, avatar_url, talent, is_verified').in('id', otherIds);
  console.log('Profiles error:', pErr?.message);
  console.log('Profiles:', profiles);

  // Build profMap exactly as code does
  const profMap = {};
  (profiles || []).forEach(p => { profMap[p.id] = p; });
  console.log('\nprofMap keys:', Object.keys(profMap));

  const threads = deduped.map(d => ({ otherUser: profMap[d.otherId] || { id: d.otherId, username: 'Unknown' }, lastMsg: d.lastMsg }));
  console.log('\nFinal threads:', threads.map(t => ({ username: t.otherUser.username, full_name: t.otherUser.full_name })));
}

run();
