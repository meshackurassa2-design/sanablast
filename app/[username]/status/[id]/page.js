'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';
import Link from 'next/link';

export default function StatusPage() {
  const { username, id } = useParams();
  const router = useRouter();
  const [blast, setBlast] = useState(null);
  const [replies, setReplies] = useState([]);
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const replyInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfileData(data));
    }
  }, [user]);

  useEffect(() => {
    if (id) {
      fetchStatus();
      
      // Increment views safely
      const incrementViews = async () => {
        const { error } = await supabase.rpc('increment_views', { blast_id: id });
        if (error) {
          // Fallback if RPC doesn't exist
          await supabase.from('blasts').update({ views_count: (blast?.views_count || 0) + 1 }).eq('id', id);
        }
      };
      incrementViews();

      // Listen for changes in this specific blast and its replies
      const channel = supabase
        .channel(`status_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'blasts' }, fetchStatus)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchStatus)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reposts' }, fetchStatus)
        .subscribe();
        
      return () => supabase.removeChannel(channel);
    }
  }, [id]);

  const fetchStatus = async () => {
    try {
      // 1. Fetch main blast
      const { data: bData, error: bError } = await supabase
        .from('blasts')
        .select('*')
        .eq('id', id)
        .single();

      if (bError) throw bError;
      if (!bData) return;

      // 2. Fetch replies
      const { data: rData, error: rError } = await supabase
        .from('blasts')
        .select('*')
        .eq('reply_to', id)
        .order('created_at', { ascending: true });

      if (rError) throw rError;

      const allBlasts = [bData, ...(rData || [])];
      const userIds = [...new Set(allBlasts.map(b => b.user_id).filter(Boolean))];
      const blastIds = allBlasts.map(b => b.id);

      const [profilesRes, likesRes, repostsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url, talent, is_verified').in('id', userIds),
        supabase.from('likes').select('id, blast_id, user_id').in('blast_id', blastIds),
        supabase.from('reposts').select('id, blast_id, user_id').in('blast_id', blastIds),
      ]);

      const profileMap = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });

      const enrich = (b) => ({
        ...b,
        profiles: profileMap[b.user_id] || null,
        likes: (likesRes.data || []).filter(l => l.blast_id === b.id),
        reposts: (repostsRes.data || []).filter(r => r.blast_id === b.id),
      });

      setBlast(enrich(bData));
      setReplies((rData || []).map(enrich));

    } catch (err) {
      console.error('Fetch status failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostReply = async () => {
    if (!user) { router.push('/login'); return; }
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from('blasts').insert([{
        content: replyText.trim(),
        user_id: user.id,
        reply_to: id
      }]);
      if (error) throw error;
      setReplyText('');
      fetchStatus();
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (blastId) => {
    if (!user) { router.push('/login'); return; }
    const target = blastId === blast.id ? blast : replies.find(r => r.id === blastId);
    const isLiked = target.likes?.some(l => l.user_id === user.id);
    
    if (isLiked) await supabase.from('likes').delete().eq('blast_id', blastId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ blast_id: blastId, user_id: user.id }]);
    
    fetchStatus();
  };

  const handleRepost = async (blastId) => {
    if (!user) { router.push('/login'); return; }
    const target = blastId === blast.id ? blast : replies.find(r => r.id === blastId);
    const isReposted = target.reposts?.some(r => r.user_id === user.id);
    
    if (isReposted) await supabase.from('reposts').delete().eq('blast_id', blastId).eq('user_id', user.id);
    else await supabase.from('reposts').insert([{ blast_id: blastId, user_id: user.id }]);
    
    fetchStatus();
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const focusReply = () => {
    replyInputRef.current?.focus();
    replyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url || null;
  const currentUserHandle = profileData?.username || user?.user_metadata?.username || 'user';
  const fullName = profileData?.full_name || user?.user_metadata?.full_name || profileData?.username || 'User';

  const Avatar = ({ src, name, size = 40, onClick }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return src
      ? <img src={src} alt="avatar" onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }} />
      : <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#cfd9de', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.4, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
          {initial}
        </div>
  };

  const VerificationBadge = ({ course, isVerified }) => {
    if (!isVerified) return null;
    const c = course?.toLowerCase() || '';
    
    // Default Blue Verified Star
    let badgeColor = '#1d9bf0';
    let pathD = "M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z";

    if (c.includes('filming') || c.includes('video') || c.includes('television') || c.includes('movie')) {
      badgeColor = '#eab308'; // Gold Film Strip
      pathD = "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z";
    } else if (c.includes('music') || c.includes('audio') || c.includes('singer')) {
      badgeColor = '#f91880'; // Pink Music Note
      pathD = "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z";
    } else if (c.includes('art') || c.includes('draw') || c.includes('paint')) {
      badgeColor = '#00ba7c'; // Green Paint Palette
      pathD = "M12 2C6.49 2 2 6.49 2 12s4.49 10 9.99 10C13.65 22 15 20.65 15 19s-1.35-3-3-3c-1.66 0-3-1.34-3-3s1.34-3 3-3h1.27c2.97 0 5.73-2.43 5.73-5.5C19 4.49 15.51 2 12 2zm-4.5 9c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8 9 8.67 9 9.5 8.33 11 7.5 11zm4.5-4C11.17 7 10.5 6.33 10.5 5.5S11.17 4 12 4s1.5.67 1.5 1.5S12.83 7 12 7zm4.5 4c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11z";
    }

    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={badgeColor} style={{ marginLeft: '4px', flexShrink: 0 }}>
        <path d={pathD} />
      </svg>
    );
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>Loading...</div>;
  if (!blast) return <div style={{ minHeight: '100vh', padding: '20px', color: 'var(--text)' }}>Post not found</div>;

  return (
    <div className="layout">
      <Sidebar user={user} />
      
      <main className="feed" style={{ paddingBottom: '120px' }}>
        <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '30px', padding: '0 16px' }}>
          <div onClick={() => router.back()} style={{ cursor: 'pointer', padding: '10px 0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Post</h2>
        </header>

        {/* ── Main Post View ── */}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Avatar src={blast.profiles?.avatar_url || (blast.user_id === user?.id ? avatarUrl : null)} name={blast.profiles?.full_name || blast.profiles?.username || (blast.user_id === user?.id ? fullName : 'User')} size={44} onClick={() => router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? currentUserHandle : 'user')}`)} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                  {blast.profiles?.full_name || blast.profiles?.username || (blast.user_id === user?.id ? fullName : 'User')} <VerificationBadge course={blast.profiles?.talent || (blast.user_id === user?.id ? profileData?.talent : null)} isVerified={blast.profiles?.is_verified || (blast.user_id === user?.id ? profileData?.is_verified : false)} />
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>@{blast.profiles?.username || (blast.user_id === user?.id ? currentUserHandle : 'user')}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '1.45rem', fontWeight: '500', lineHeight: '1.25', color: 'var(--text)', marginBottom: '16px', whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>
            {blast.content}
          </div>

          {blast.media_url && (
            <div className="blast-media-container" style={{ marginBottom: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              {blast.media_type === 'video' 
                ? <video src={blast.media_url} controls autoPlay muted playsInline />
                : <img src={blast.media_url} alt="content" />
              }
            </div>
          )}

          <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem', paddingBottom: '16px' }}>
            {new Date(blast.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · <b style={{ color: 'var(--text)' }}>{(blast.views_count || 0).toLocaleString()}</b> Views
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0' }}>
            <div onClick={focusReply} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '0.9rem' }}>{replies.length || ''}</span>
            </div>
            <div onClick={() => handleRepost(blast.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: blast.reposts?.some(r => r.user_id === user?.id) ? '#00ba7c' : 'var(--text-dim)', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
              <span style={{ fontSize: '0.9rem' }}>{blast.reposts?.length || ''}</span>
            </div>
            <div onClick={() => handleLike(blast.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: blast.likes?.some(l => l.user_id === user?.id) ? '#f91880' : 'var(--text-dim)', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={blast.likes?.some(l => l.user_id === user?.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span style={{ fontSize: '0.9rem' }}>{blast.likes?.length || ''}</span>
            </div>
            <div style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div onClick={handleShare} style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </div>
          </div>
        </div>

        {/* ── Thread Filter ── */}
        <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          Relevant <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>

        {/* ── Replies Feed ── */}
        {replies.map(reply => (
          <div key={reply.id} className="blast-card" onClick={() => router.push(`/${reply.profiles?.username || (reply.user_id === user?.id ? currentUserHandle : 'user')}/status/${reply.id}`)}>
            <div style={{ position: 'relative' }}>
                <Avatar src={reply.profiles?.avatar_url || (reply.user_id === user?.id ? avatarUrl : null)} name={reply.profiles?.full_name || reply.profiles?.username || (reply.user_id === user?.id ? fullName : 'User')} size={40} onClick={() => router.push(`/${reply.profiles?.username || (reply.user_id === user?.id ? currentUserHandle : 'user')}`)} />
              {/* Vertical Thread Line */}
              <div style={{ position: 'absolute', top: '44px', bottom: '-16px', left: '20px', width: '2px', backgroundColor: 'var(--border)' }}></div>
            </div>
            <div className="blast-body">
              <div className="blast-user">
                <span className="name" onClick={() => router.push(`/${reply.profiles?.username || (reply.user_id === user?.id ? currentUserHandle : 'user')}`)} style={{ display: 'flex', alignItems: 'center' }}>
                  {reply.profiles?.full_name || reply.profiles?.username || (reply.user_id === user?.id ? fullName : 'User')} <VerificationBadge course={reply.profiles?.talent || (reply.user_id === user?.id ? profileData?.talent : null)} isVerified={reply.profiles?.is_verified || (reply.user_id === user?.id ? profileData?.is_verified : false)} />
                </span>
                <span className="handle">@{reply.profiles?.username || (reply.user_id === user?.id ? currentUserHandle : 'user')}</span>
                <span style={{ color: 'var(--text-dim)' }}>· {new Date(reply.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="content" style={{ fontSize: '1rem', lineHeight: '1.5', color: 'var(--text)' }}>
                {reply.content}
              </div>
              <div className="actions" style={{ marginTop: '12px', opacity: 0.7 }}>
                <div className="action-item reply"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> 1</div>
                <div className="action-item repost"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg></div>
                <div className="action-item like"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 1</div>
                <div className="action-item share"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ── Fixed Pill Reply Bar ── */}
      <div style={{ position: 'fixed', bottom: '65px', left: 0, right: 0, padding: '8px 16px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '30px', padding: '8px 16px' }}>
          <Avatar src={profileData?.avatar_url} size={28} />
          <input
            ref={replyInputRef}
            type="text"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePostReply()}
            placeholder="Post your reply"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1rem', outline: 'none' }}
          />
          <button
            onClick={handlePostReply}
            disabled={posting || !replyText.trim()}
            style={{ color: 'var(--primary)', background: 'transparent', border: 'none', fontWeight: '800', fontSize: '0.95rem', opacity: (posting || !replyText.trim()) ? 0.5 : 1 }}>
            Post
          </button>
        </div>
      </div>

      <TrendsSidebar />
      <MobileNav />
    </div>
  );
}
