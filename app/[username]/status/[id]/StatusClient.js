'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';
import Link from 'next/link';
import { FeedSkeleton } from '@/components/Loaders';

export default function StatusClient() {
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
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
  }, []);

  useEffect(() => {
    if (user) supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfileData(data));
  }, [user]);

  useEffect(() => {
    if (!id) return;
    fetchStatus();
    supabase.rpc('increment_views', { blast_id: id }).catch(() => {});
    const channel = supabase.channel(`status_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blasts' }, fetchStatus)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchStatus)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reposts' }, fetchStatus)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  const fetchStatus = async () => {
    try {
      const { data: bData, error: bError } = await supabase.from('blasts').select('*').eq('id', id).single();
      if (bError || !bData) return;
      const { data: rData } = await supabase.from('blasts').select('*').eq('reply_to', id).order('created_at', { ascending: true });
      const allBlasts = [bData, ...(rData || [])];
      const userIds = [...new Set(allBlasts.map(b => b.user_id).filter(Boolean))];
      const blastIds = allBlasts.map(b => b.id);
      const [profilesRes, likesRes, repostsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds),
        supabase.from('likes').select('id, blast_id, user_id').in('blast_id', blastIds),
        supabase.from('reposts').select('id, blast_id, user_id').in('blast_id', blastIds),
      ]);
      const profileMap = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });
      const enrich = (b) => ({ ...b, profiles: profileMap[b.user_id] || null, likes: (likesRes.data || []).filter(l => l.blast_id === b.id), reposts: (repostsRes.data || []).filter(r => r.blast_id === b.id) });
      setBlast(enrich(bData));
      setReplies((rData || []).map(enrich));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handlePostReply = async () => {
    if (!user) { router.push('/login'); return; }
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      await supabase.from('blasts').insert([{ content: replyText.trim(), user_id: user.id, reply_to: id }]);
      setReplyText('');
      fetchStatus();
    } catch (err) { alert(err.message); }
    finally { setPosting(false); }
  };

  const handleLike = async (blastId) => {
    if (!user) { router.push('/login'); return; }
    const target = blastId === blast?.id ? blast : replies.find(r => r.id === blastId);
    const isLiked = target?.likes?.some(l => l.user_id === user.id);
    if (isLiked) await supabase.from('likes').delete().eq('blast_id', blastId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ blast_id: blastId, user_id: user.id }]);
    fetchStatus();
  };

  const handleRepost = async (blastId) => {
    if (!user) { router.push('/login'); return; }
    const target = blastId === blast?.id ? blast : replies.find(r => r.id === blastId);
    const isReposted = target?.reposts?.some(r => r.user_id === user.id);
    if (isReposted) await supabase.from('reposts').delete().eq('blast_id', blastId).eq('user_id', user.id);
    else await supabase.from('reposts').insert([{ blast_id: blastId, user_id: user.id }]);
    fetchStatus();
  };

  const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url || null;
  const currentUserHandle = profileData?.username || user?.user_metadata?.username || 'user';
  const fullName = profileData?.full_name || user?.user_metadata?.full_name || 'User';

  const Avatar = ({ src, name, size = 40, onClick }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return src
      ? <img src={src} alt="avatar" onClick={onClick} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', cursor:onClick?'pointer':'default', flexShrink:0 }} />
      : <div onClick={onClick} style={{ width:size, height:size, borderRadius:'50%', backgroundColor:'#cfd9de', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:size*0.4, cursor:onClick?'pointer':'default', flexShrink:0 }}>{initial}</div>;
  };

  const VerificationBadge = ({ isVerified }) => {
    if (!isVerified) return null;
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d9bf0" style={{ marginLeft:'4px' }}><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z"/></svg>;
  };

  if (loading) return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed"><FeedSkeleton count={3} /></main>
      <div className="right-sidebar"><TrendsSidebar /></div>
    </div>
  );
  if (!blast) return <div style={{ minHeight:'100vh', padding:'20px', color:'#0f1419' }}>Post not found</div>;

  const authorName = blast.profiles?.full_name || blast.profiles?.username || (blast.user_id===user?.id ? fullName : 'User');
  const authorHandle = blast.profiles?.username || (blast.user_id===user?.id ? currentUserHandle : 'user');
  const authorAvatar = blast.profiles?.avatar_url || (blast.user_id===user?.id ? avatarUrl : null);

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed" style={{ paddingBottom:'120px' }}>
        <header className="feed-header" style={{ display:'flex', alignItems:'center', gap:'30px', padding:'0 16px' }}>
          <div onClick={() => router.back()} style={{ cursor:'pointer', padding:'10px 0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </div>
          <h2 style={{ fontSize:'1.2rem', fontWeight:'800' }}>Post</h2>
        </header>

        <div style={{ padding:'16px' }}>
          <div style={{ display:'flex', gap:'12px', marginBottom:'16px' }}>
            <Avatar src={authorAvatar} name={authorName} size={44} onClick={() => router.push(`/${authorHandle}`)} />
            <div>
              <div style={{ fontWeight:'800', fontSize:'1rem', display:'flex', alignItems:'center', gap:'4px', color:'#0f1419' }}>
                {authorName} <VerificationBadge isVerified={blast.profiles?.is_verified} />
              </div>
              <div style={{ color:'#536471' }}>@{authorHandle}</div>
            </div>
          </div>

          <div style={{ fontSize:'1.45rem', fontWeight:'500', lineHeight:'1.25', color:'#0f1419', marginBottom:'16px', whiteSpace:'pre-wrap' }}>{blast.content}</div>

          {blast.media_url && (
            <div style={{ marginBottom:'16px', borderRadius:'16px', overflow:'hidden', border:'1px solid #eff3f4' }}>
              {blast.media_type==='video' ? <video src={blast.media_url} controls autoPlay muted playsInline style={{ width:'100%' }} /> : <img src={blast.media_url} alt="content" style={{ width:'100%' }} />}
            </div>
          )}

          <div style={{ color:'#536471', fontSize:'0.95rem', paddingBottom:'16px', borderBottom:'1px solid #eff3f4' }}>
            {new Date(blast.created_at).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} · <b style={{ color:'#0f1419' }}>{(blast.views_count||0).toLocaleString()}</b> Views
          </div>

          <div style={{ display:'flex', justifyContent:'space-around', padding:'12px 0', borderBottom:'1px solid #eff3f4' }}>
            <div onClick={() => replyInputRef.current?.focus()} style={{ display:'flex', alignItems:'center', gap:'8px', color:'#536471', cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>{replies.length||''}</span>
            </div>
            <div onClick={() => handleRepost(blast.id)} style={{ display:'flex', alignItems:'center', gap:'8px', color: blast.reposts?.some(r=>r.user_id===user?.id)?'#00ba7c':'#536471', cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
              <span>{blast.reposts?.length||''}</span>
            </div>
            <div onClick={() => handleLike(blast.id)} style={{ display:'flex', alignItems:'center', gap:'8px', color: blast.likes?.some(l=>l.user_id===user?.id)?'#f91880':'#536471', cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={blast.likes?.some(l=>l.user_id===user?.id)?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>{blast.likes?.length||''}</span>
            </div>
          </div>
        </div>

        {replies.map(reply => {
          const rName = reply.profiles?.full_name || reply.profiles?.username || (reply.user_id===user?.id ? fullName : 'User');
          const rHandle = reply.profiles?.username || (reply.user_id===user?.id ? currentUserHandle : 'user');
          const rAvatar = reply.profiles?.avatar_url || (reply.user_id===user?.id ? avatarUrl : null);
          return (
            <div key={reply.id} className="blast-card" onClick={() => router.push(`/${rHandle}/status/${reply.id}`)}>
              <Avatar src={rAvatar} name={rName} size={40} onClick={(e) => { e.stopPropagation(); router.push(`/${rHandle}`); }} />
              <div className="blast-body">
                <div className="blast-user">
                  <span className="name">{rName}</span>
                  <span className="handle">@{rHandle}</span>
                  <span style={{ color:'#536471' }}>· {new Date(reply.created_at).toLocaleDateString()}</span>
                </div>
                <div className="content" style={{ fontSize:'1rem', lineHeight:'1.5', color:'#0f1419' }}>{reply.content}</div>
                <div className="actions" style={{ marginTop:'12px' }}>
                  <div className="action-item like" onClick={e => { e.stopPropagation(); handleLike(reply.id); }} style={{ color: reply.likes?.some(l=>l.user_id===user?.id)?'#f91880':'' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span>{reply.likes?.length||0}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <div style={{ position:'fixed', bottom:'65px', left:0, right:0, padding:'8px 16px', background:'rgba(255,255,255,0.9)', backdropFilter:'blur(12px)', zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', background:'#fff', borderRadius:'30px', padding:'8px 16px', border:'1px solid #eff3f4' }}>
          <Avatar src={profileData?.avatar_url} name={fullName} size={28} />
          <input ref={replyInputRef} type="text" value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key==='Enter' && handlePostReply()} placeholder="Post your reply" style={{ flex:1, background:'transparent', border:'none', color:'#0f1419', fontSize:'1rem', outline:'none' }} />
          <button onClick={handlePostReply} disabled={posting||!replyText.trim()} style={{ color:'#1d9bf0', background:'transparent', border:'none', fontWeight:'800', fontSize:'0.95rem', opacity:(posting||!replyText.trim())?0.5:1 }}>Post</button>
        </div>
      </div>

      <TrendsSidebar />
      <MobileNav />
    </div>
  );
}
