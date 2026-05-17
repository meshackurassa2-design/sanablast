'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase, supabaseService } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import { FeedSkeleton, MessageSkeleton } from '@/components/Loaders';

/* ── Verification Badge ── */
const VerificationBadge = ({ talent, isVerified }) => {
  if (!isVerified) return null;
  const c = talent?.toLowerCase() || '';
  let color = '#1d9bf0';
  let d = "M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z";
  if (c.includes('film') || c.includes('video') || c.includes('television') || c.includes('movie')) {
    color = '#eab308'; d = "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z";
  } else if (c.includes('music') || c.includes('audio') || c.includes('sing')) {
    color = '#f91880'; d = "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z";
  } else if (c.includes('art') || c.includes('draw') || c.includes('paint')) {
    color = '#00ba7c'; d = "M12 2C6.49 2 2 6.49 2 12s4.49 10 9.99 10C13.65 22 15 20.65 15 19s-1.35-3-3-3c-1.66 0-3-1.34-3-3s1.34-3 3-3h1.27c2.97 0 5.73-2.43 5.73-5.5C19 4.49 15.51 2 12 2zm-4.5 9c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8 9 8.67 9 9.5 8.33 11 7.5 11zm4.5-4C11.17 7 10.5 6.33 10.5 5.5S11.17 4 12 4s1.5.67 1.5 1.5S12.83 7 12 7zm4.5 4c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11z";
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={color} style={{ marginLeft: '4px', flexShrink: 0 }}><path d={d} /></svg>;
};

/* ── Avatar with letter fallback ── */
const Avatar = ({ user, size = 42 }) => {
  const name = user?.full_name || user?.username || '?';
  if (user?.avatar_url) return (
    <img src={user.avatar_url} alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#1d9bf0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.4, flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  );
};

export default function MessagesPage() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list');   // 'list' | 'search' | 'chat'
  const [threads, setThreads] = useState([]); // [{otherUser, lastMsg, unread}]
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  /* Auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  /* Load threads when on list view */
  useEffect(() => { if (user && view === 'list') loadThreads(); }, [user, view]);

  /* Load messages when entering chat */
  useEffect(() => { if (user && view === 'chat' && chatUser) loadMessages(); }, [user, view, chatUser]);

  /* Realtime: listen for new messages in current chat */
  useEffect(() => {
    if (!user || view !== 'chat' || !chatUser) return;
    const ch = supabase.channel(`dm_${[user.id, chatUser.id].sort().join('_')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: msg }) => {
        if (
          (msg.sender_id === chatUser.id && msg.receiver_id === user.id) ||
          (msg.sender_id === user.id && msg.receiver_id === chatUser.id)
        ) setMessages(prev => [...prev, msg]);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, view, chatUser]);

  /* Auto-scroll */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── Load conversation threads ── */
  const loadThreads = async () => {
    setLoading(true);
    // Get all messages involving me, newest first
    const [sent, received] = await Promise.all([
      supabase.from('messages').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false }),
    ]);
    const all = [...(sent.data || []), ...(received.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Deduplicate by the other person's id — keep first (newest) message per thread
    const seen = new Set();
    const deduped = [];
    all.forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!otherId || seen.has(otherId)) return;
      seen.add(otherId);
      deduped.push({ otherId, lastMsg: msg });
    });

    if (deduped.length === 0) { setThreads([]); setLoading(false); return; }

    // Fetch all other users' profiles
    const otherIds = deduped.map(d => d.otherId);
    const { data: profiles } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', otherIds);
    const profMap = {};
    (profiles || []).forEach(p => { profMap[p.id] = p; });

    setThreads(deduped.map(d => ({ otherUser: profMap[d.otherId] || { id: d.otherId, username: 'Unknown' }, lastMsg: d.lastMsg })));
    setLoading(false);
  };

  /* ── Load messages for a chat ── */
  const loadMessages = async () => {
    const [sent, recv] = await Promise.all([
      supabase.from('messages').select('*').eq('sender_id', user.id).eq('receiver_id', chatUser.id).order('created_at', { ascending: true }),
      supabase.from('messages').select('*').eq('sender_id', chatUser.id).eq('receiver_id', user.id).order('created_at', { ascending: true }),
    ]);
    const combined = [...(sent.data || []), ...(recv.data || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    setMessages(combined);
  };

  /* ── Search ── */
  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQ(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url').ilike('username', `%${q}%`).neq('id', user.id).limit(10);
    setResults(data || []);
  };

  const openChat = (otherUser) => {
    setChatUser(otherUser);
    setMessages([]);
    setView('chat');
    setSearchQ('');
    setResults([]);
  };

  /* ── Send ── */
  const sendMessage = async () => {
    if (!draft.trim() || !chatUser || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    const { data: newMsg, error } = await supabaseService.from('messages')
      .insert([{ sender_id: user.id, receiver_id: chatUser.id, content: text }])
      .select().single();
    if (error) {
      console.error('sendMessage:', error.message);
      alert('Failed to send: ' + error.message);
    } else if (newMsg) {
      setMessages(prev => [...prev, newMsg]);
    }
    setSending(false);
  };

  if (!user) return (
    <div className="layout">
      <Sidebar />
      <main className="feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: '#0f1419' }}>Sign in to see messages</h2>
      </main>
      <MobileNav />
    </div>
  );

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', paddingBottom: view === 'chat' ? 0 : undefined }}>

        {/* ── HEADER ── */}
        <header style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', gap: '12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {view === 'chat' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <button onClick={() => { setView('list'); setChatUser(null); setMessages([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f1419', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <Avatar user={chatUser} size={38} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontWeight: 850, color: '#0f1419', fontSize: '1.02rem', lineHeight: 1.2, display: 'flex', alignItems: 'center' }}>
                  {chatUser.full_name || chatUser.username}
                  <VerificationBadge talent={chatUser.talent} isVerified={chatUser.is_verified} />
                </span>
                <span style={{ color: '#536471', fontSize: '0.78rem', fontWeight: 400, marginTop: '1px' }}>
                  @{chatUser.username}
                </span>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ margin: 0, flex: 1, fontSize: '1.2rem', fontWeight: 800, color: '#0f1419' }}>Messages</h2>
              <button onClick={() => setView('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#536471' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </>
          )}
        </header>

        {/* ── LIST ── */}
        {view === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* search bar */}
            <div style={{ padding: '12px 16px' }}>
              <div onClick={() => setView('search')} style={{ display: 'flex', alignItems: 'center', background: '#eff3f4', borderRadius: '30px', padding: '10px 16px', cursor: 'pointer', gap: '10px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span style={{ color: '#536471', fontSize: '0.95rem' }}>Search Direct Messages</span>
              </div>
            </div>

            {loading && <MessageSkeleton count={6} />}
            {!loading && threads.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#536471' }}>
                <h3 style={{ color: '#0f1419', margin: '0 0 8px' }}>No messages yet</h3>
                <p style={{ margin: '0 0 20px' }}>Search for someone and say hi!</p>
                <button onClick={() => setView('search')} style={{ padding: '10px 24px', borderRadius: '24px', background: '#1d9bf0', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>New Message</button>
              </div>
            )}
            {threads.map(({ otherUser, lastMsg }) => (
              <div key={otherUser.id} onClick={() => openChat(otherUser)}
                style={{ display: 'flex', gap: '12px', padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <Avatar user={otherUser} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, color: '#0f1419', display: 'flex', alignItems: 'center', fontSize: '0.95rem' }}>
                      {otherUser.full_name || otherUser.username}
                    </span>
                    <span style={{ color: '#536471', fontSize: '0.8rem', flexShrink: 0, marginLeft: '6px' }}>
                      {new Date(lastMsg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ color: '#536471', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {lastMsg.sender_id === user.id ? '↗ ' : ''}{lastMsg.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SEARCH ── */}
        {view === 'search' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f1419', fontSize: '1.3rem', lineHeight: 1 }}>←</button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#eff3f4', borderRadius: '30px', padding: '10px 16px', gap: '10px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search by username…" value={searchQ} onChange={handleSearch} autoFocus
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem', color: '#0f1419' }} />
              </div>
            </div>
            {results.length === 0 && searchQ.length > 1 && (
              <p style={{ textAlign: 'center', color: '#536471', padding: '24px' }}>No users found for "{searchQ}"</p>
            )}
            {results.map(r => (
              <div key={r.id} onClick={() => openChat(r)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <Avatar user={r} size={46} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f1419', display: 'flex', alignItems: 'center' }}>
                    {r.full_name || r.username}
                  </div>
                  <div style={{ color: '#536471', fontSize: '0.9rem' }}>@{r.username}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CHAT ── */}
        {view === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Profile Intro Card */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', textAlign: 'center' }}>
                <Avatar user={chatUser} size={80} />
                <h3 style={{ margin: '12px 0 2px', fontSize: '1.2rem', fontWeight: 900, color: '#0f1419' }}>
                  {chatUser.full_name || chatUser.username}
                </h3>
                <span style={{ color: '#536471', fontSize: '0.92rem' }}>@{chatUser.username}</span>
                <span style={{ color: '#536471', fontSize: '0.85rem', marginTop: '6px' }}>
                  Joined {chatUser.created_at ? new Date(chatUser.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'March 2026'}
                </span>
                <button onClick={() => window.location.href = `/${chatUser.username}`}
                  style={{ marginTop: '14px', border: '1px solid #cfd9de', borderRadius: '20px', background: '#fff', color: '#0f1419', padding: '6px 18px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}>
                  View Profile
                </button>
              </div>

              {messages.map((msg, i) => {
                const mine = msg.sender_id === user.id;
                const timeStr = msg.created_at 
                  ? new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                  : new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
                
                return (
                  <div key={msg.id || i} style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    background: mine ? '#1d9bf0' : '#eff3f4',
                    color: mine ? '#fff' : '#0f1419',
                    padding: '8px 14px 6px 14px',
                    borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    maxWidth: '75%',
                    wordBreak: 'break-word',
                    fontSize: '0.97rem',
                    lineHeight: 1.4,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>
                    <span style={{ marginRight: mine ? '48px' : '36px' }}>{msg.content}</span>
                    <span style={{
                      alignSelf: 'flex-end',
                      fontSize: '0.70rem',
                      color: mine ? 'rgba(255,255,255,0.72)' : '#536471',
                      marginTop: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      marginLeft: 'auto'
                    }}>
                      {timeStr}
                      {mine && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.95, verticalAlign: 'middle' }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Input Overhaul matching Telegram UX screenshot */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', background: '#fff', flexShrink: 0, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
              {/* Circular plus media button */}
              <button style={{
                background: '#eff3f4',
                border: 'none',
                borderRadius: '50%',
                width: 42,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#0f1419',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>

              {/* Input pill containing microphone/waveform icon */}
              <div style={{ position: 'relative', display: 'flex', flex: 1, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Message"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  style={{
                    width: '100%',
                    background: '#eff3f4',
                    border: 'none',
                    borderRadius: '24px',
                    padding: '12px 42px 12px 18px',
                    outline: 'none',
                    fontSize: '1rem',
                    color: '#0f1419',
                  }}
                />
                
                {/* Voice message / Mic icon inside the input pill at the right */}
                <div style={{ position: 'absolute', right: '14px', display: 'flex', alignItems: 'center', color: '#536471' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                  </svg>
                </div>
              </div>

              {/* Dynamic send button shown when user types */}
              {draft.trim() && (
                <button onClick={sendMessage} disabled={sending}
                  style={{
                    background: '#1d9bf0',
                    border: 'none',
                    borderRadius: '50%',
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {view !== 'chat' && <MobileNav />}
    </div>
  );
}
