'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FeedSkeleton } from '@/components/Loaders';

export default function Home() {
  const router = useRouter();
  // ── ALL HOOKS AT TOP (React rules) ──
  const [blasts, setBlasts] = useState([]);
  const [feedTab, setFeedTab] = useState('foryou');
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeMedia, setComposeMedia] = useState(null);
  const [composeCategory, setComposeCategory] = useState('General');
  const [posting, setPosting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const composeRef = useRef(null);
  const mediaInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // ── AUTH ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── FETCH USER PROFILE FROM DB ──
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfileData(data);
          // Cache profile for instant loading
          try { localStorage.setItem('sb_profile_' + user.id, JSON.stringify(data)); } catch(_) {}
        }
      });
    // Load cached profile instantly
    try {
      const cached = localStorage.getItem('sb_profile_' + user.id);
      if (cached) setProfileData(JSON.parse(cached));
    } catch(_) {}
  }, [user]);

  // ── FETCH BLASTS + REALTIME ──
  useEffect(() => {
    // Stale-while-revalidate: show cache instantly, fetch fresh in background
    try {
      const cached = localStorage.getItem('sb_blasts_feed');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setBlasts(parsed);
          setLoading(false); // show UI immediately
        }
      }
    } catch(_) {}

    fetchBlasts();

    // Surgical real-time: only full re-fetch on new blasts
    const channel = supabase
      .channel('realtime_interactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blasts' }, fetchBlasts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blasts' }, (payload) => {
        // Surgically update only the changed blast (views, etc)
        setBlasts(prev => prev.map(b =>
          b.id === payload.new.id ? { ...b, views_count: payload.new.views_count } : b
        ));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        setBlasts(prev => prev.map(b =>
          b.id === payload.new.blast_id
            ? { ...b, likes: [...(b.likes || []), payload.new] }
            : b
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => {
        setBlasts(prev => prev.map(b =>
          b.id === payload.old.blast_id
            ? { ...b, likes: (b.likes || []).filter(l => l.id !== payload.old.id) }
            : b
        ));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reposts' }, (payload) => {
        setBlasts(prev => prev.map(b =>
          b.id === payload.new.blast_id
            ? { ...b, reposts: [...(b.reposts || []), payload.new] }
            : b
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reposts' }, (payload) => {
        setBlasts(prev => prev.map(b =>
          b.id === payload.old.blast_id
            ? { ...b, reposts: (b.reposts || []).filter(r => r.id !== payload.old.id) }
            : b
        ));
      })
      .subscribe();

    const handleOpenCompose = () => openCompose();
    window.addEventListener('open-compose', handleOpenCompose);
    window.addEventListener('blast-posted', fetchBlasts);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('open-compose', handleOpenCompose);
      window.removeEventListener('blast-posted', fetchBlasts);
    };
  }, []);

  // Fetch when tab or user changes
  useEffect(() => {
    fetchBlasts();
  }, [feedTab, user]);

  const fetchBlasts = async () => {
    try {
      setLoading(true);
      let bData = [];
      let bError = null;

      if (feedTab === 'following') {
        if (!user) {
          setBlasts([]);
          setLoading(false);
          return;
        }
        // Get followed profiles
        const { data: followsData, error: fError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (fError || !followsData || followsData.length === 0) {
          setBlasts([]);
          setLoading(false);
          return;
        }

        const followingIds = followsData.map(f => f.following_id);
        const { data, error } = await supabase
          .from('blasts')
          .select('id, content, user_id, created_at, media_url, media_type, category, views_count, reply_to')
          .in('user_id', [...followingIds, user.id])
          .order('created_at', { ascending: false })
          .limit(30);
        bData = data;
        bError = error;
      } else {
        const { data, error } = await supabase
          .from('blasts')
          .select('id, content, user_id, created_at, media_url, media_type, category, views_count, reply_to')
          .order('created_at', { ascending: false })
          .limit(30);
        bData = data;
        bError = error;
      }

      if (bError || !bData || bData.length === 0) {
        setBlasts([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch profiles + engagement in parallel
      const userIds = [...new Set(bData.map(b => b.user_id).filter(Boolean))];
      const blastIds = bData.map(b => b.id);

      const [profilesRes, likesRes, repostsRes, repliesRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds),
        supabase.from('likes').select('id, blast_id, user_id').in('blast_id', blastIds),
        supabase.from('reposts').select('id, blast_id, user_id').in('blast_id', blastIds),
        supabase.from('blasts').select('id, reply_to').in('reply_to', blastIds)
      ]);

      const profileMap = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = bData
        .filter(b => !b.reply_to)
        .map(b => ({
          ...b,
          profiles: profileMap[b.user_id] || null,
          likes: (likesRes.data || []).filter(l => l.blast_id === b.id),
          reposts: (repostsRes.data || []).filter(r => r.blast_id === b.id),
          comments: (repliesRes.data || []).filter(rep => rep.reply_to === b.id)
        }));

      setBlasts(enriched);
      // Cache only the main 'For You' feed for instant load
      if (feedTab === 'foryou') {
        try { localStorage.setItem('sb_blasts_feed', JSON.stringify(enriched)); } catch(_) {}
      }
    } catch (err) {
      console.error('Fetch blasts failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (blastId) => {
    if (!user) { window.location.href = '/login'; return; }
    const blast = blasts.find(b => b.id === blastId);
    const isLiked = blast?.likes?.some(l => l.user_id === user.id);
    // Optimistic update
    const fakeId = 'opt_' + Date.now();
    if (isLiked) {
      setBlasts(prev => prev.map(b => b.id === blastId ? { ...b, likes: b.likes.filter(l => l.user_id !== user.id) } : b));
      await supabase.from('likes').delete().eq('blast_id', blastId).eq('user_id', user.id);
    } else {
      setBlasts(prev => prev.map(b => b.id === blastId ? { ...b, likes: [...(b.likes || []), { id: fakeId, blast_id: blastId, user_id: user.id }] } : b));
      await supabase.from('likes').insert([{ blast_id: blastId, user_id: user.id }]);
    }
  };

  const handleRepost = async (blastId) => {
    if (!user) { window.location.href = '/login'; return; }
    const blast = blasts.find(b => b.id === blastId);
    const isReposted = blast?.reposts?.some(r => r.user_id === user.id);
    // Optimistic update
    const fakeId = 'opt_' + Date.now();
    if (isReposted) {
      setBlasts(prev => prev.map(b => b.id === blastId ? { ...b, reposts: b.reposts.filter(r => r.user_id !== user.id) } : b));
      await supabase.from('reposts').delete().eq('blast_id', blastId).eq('user_id', user.id);
    } else {
      setBlasts(prev => prev.map(b => b.id === blastId ? { ...b, reposts: [...(b.reposts || []), { id: fakeId, blast_id: blastId, user_id: user.id }] } : b));
      await supabase.from('reposts').insert([{ blast_id: blastId, user_id: user.id }]);
    }
  };

  // ── INCREMENT VIEW COUNT (optimistic + DB) ──
  const incrementView = async (blastId) => {
    try {
      setBlasts(prev => prev.map(b =>
        b.id === blastId ? { ...b, views_count: (b.views_count || 0) + 1 } : b
      ));
      await supabase.rpc('increment_views', { blast_id: blastId });
    } catch (err) {
      console.warn('Views RPC increment failed (optional feature):', err);
    }
  };

  // ── SEARCH ──
  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const [blastsRes, profilesRes] = await Promise.all([
      supabase.from('blasts').select('id, content, user_id, created_at').ilike('content', `%${q}%`).limit(10),
      supabase.from('profiles').select('id, username, full_name, avatar_url').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(8),
    ]);
    // Enrich blast results with profile data
    const blastData = blastsRes.data || [];
    if (blastData.length > 0) {
      const uids = [...new Set(blastData.map(b => b.user_id).filter(Boolean))];
      const { data: profs } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', uids);
      const pMap = {};
      (profs || []).forEach(p => { pMap[p.id] = p; });
      blastData.forEach(b => { b.profiles = pMap[b.user_id] || null; });
    }
    setSearchResults([
      ...(profilesRes.data || []).map(p => ({ type: 'profile', ...p })),
      ...blastData.map(b => ({ type: 'blast', ...b })),
    ]);
    setSearching(false);
  };


  const handleBlast = async () => {
    if (!user) { window.location.href = '/login'; return; }
    if (!content.trim()) return;
    const { error } = await supabase.from('blasts').insert([{ content, user_id: user.id }]);
    if (error) alert(error.message);
    else setContent('');
  };

  const openCompose = () => {
    setComposeText('');
    setComposeMedia(null);
    setComposeCategory('General');
    setComposeOpen(true);
    // Auto-focus after modal mounts
    setTimeout(() => composeRef.current?.focus(), 80);
  };

  const handleMediaPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setComposeMedia({ file, url, type });
  };

  const handlePost = async () => {
    if (!user) return;
    if (!composeText.trim() && !composeMedia) return;
    setPosting(true);
    try {
      let mediaUrl = null;
      if (composeMedia?.file) {
        const ext = composeMedia.file.name.split('.').pop();
        const path = `${user.id}/blast_${Date.now()}.${ext}`;
        await supabase.storage.from('avatars').upload(path, composeMedia.file, { upsert: true });
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        mediaUrl = data.publicUrl;
      }
      const { error } = await supabase.from('blasts').insert([{
        content: composeText.trim(),
        user_id: user.id,
        category: composeCategory,
        ...(mediaUrl ? { media_url: mediaUrl, media_type: composeMedia.type } : {}),
      }]);
      if (error) throw error;
      console.log('Post successful!');
      setComposeOpen(false);
      setComposeText('');
      setComposeMedia(null);
      fetchBlasts();
    } catch (err) {
      console.error('Post failed:', err);
      alert('Post failed: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  // ── DERIVED VALUES ──
  const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url || null;
  const username = profileData?.username || user?.user_metadata?.username || 'user';
  const fullName = profileData?.full_name || user?.user_metadata?.full_name || profileData?.username || 'You';

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

  // ── SVG ICONS ──
  const SBLogo = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--primary)">
      <path d="M3 7h11l-1.5 4H6l-1.5 4h7.5l-1.5 4H2l1.5-4h4l1.5-4H3.5L5 7z" />
      <path d="M13 7h9l-1.5 4h-5l-1.5 4h5l-1.5 4h-5l-1.5 4h9L21 19l-1.5-4h5L22 11l-1.5-4z" />
    </svg>
  );

  const Avatar = ({ src, name, size = 40, onClick }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return src
      ? <img src={src} alt="avatar" onClick={onClick}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }} />
      : <div onClick={onClick}
          style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#cfd9de', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.4, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
          {initial}
        </div>
  };

  return (
    <div className="layout">
      <Sidebar user={user} />

      {/* ══ PROFILE DRAWER — push style like X ══ */}
      {drawerOpen && (
        <>
          {/* Tap outside to close — only covers the right exposed area */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
            onClick={() => setDrawerOpen(false)}
          />

          {/* ── Slide-in panel (no right border, edge-to-edge) ── */}
          <div
            className="drawer-panel"
            onClick={e => e.stopPropagation()}
          >
            {/* User header */}
            <div style={{ padding: '16px 16px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <Avatar src={avatarUrl} size={44} />
                {/* Switch account icon (circle with +) */}
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
              </div>
              <div style={{ fontWeight: '900', fontSize: '1rem', color: 'var(--text)', lineHeight: 1.3, display: 'flex', alignItems: 'center' }}>
                {fullName} <VerificationBadge course={profileData?.talent} isVerified={profileData?.is_verified} />
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: '12px' }}>@{username}</div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.88rem' }}>
                <span><b style={{ color: 'var(--text)', fontWeight: '700' }}>0</b> <span style={{ color: 'var(--text-dim)' }}>Following</span></span>
                <span><b style={{ color: 'var(--text)', fontWeight: '700' }}>0</b> <span style={{ color: 'var(--text-dim)' }}>Followers</span></span>
              </div>
            </div>

            {/* Primary menu */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
              {[
                { label: 'Profile', href: `/${username}`, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                { label: 'Analytics', href: '/analytics', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> },
                { label: 'Verification', href: '/verification', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z"/></svg> },
                { label: 'Bookmarks', href: '/', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
              ].map(item => (
                <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '13px 16px', color: 'var(--text)', textDecoration: 'none', fontSize: '1.18rem', fontWeight: '800' }}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Bottom menu */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 'auto', paddingTop: '4px', paddingBottom: '12px' }}>
              {[
                { label: 'Settings and privacy', href: '/', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                { label: 'Help Center', href: '/', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg> },
              ].map(item => (
                <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '13px 16px', color: 'var(--text)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500' }}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '13px 16px', color: '#f4212e', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer' }}
                onClick={async () => { await supabase.auth.signOut(); }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </div>
            </div>
          </div>

          {/* Dimmed right side — shows page behind */}
        </>
      )}

      {/* ══ CENTER FEED — pushed right when drawer opens ══ */}
      <main
        className="feed"
        style={{
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          transform: drawerOpen ? 'translateX(78vw)' : 'translateX(0)',
        }}
      >
        <header className="feed-header">
          <div className="mobile-header">
            {/* Hamburger menu */}
            <div onClick={() => setDrawerOpen(true)} style={{ cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </div>
            
            {/* Center Logo removed */}

            {/* Search icon */}
            <div onClick={openSearch} style={{ cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          <div className="feed-tabs">
            <div className={`tab ${feedTab === 'foryou' ? 'active' : ''}`} onClick={() => setFeedTab('foryou')}>For you</div>
            <div className={`tab ${feedTab === 'following' ? 'active' : ''}`} onClick={() => {
              if (!user) {
                router.push('/login');
              } else {
                setFeedTab('following');
              }
            }}>Following</div>
          </div>

          {/* New Compose Pill (Threads style) */}
          <div className="compose-box-mobile" onClick={openCompose}>
            <Avatar src={avatarUrl} name={fullName} size={36} />
            <div className="pill-input">What's on your mind?</div>
          </div>
        </header>

        {/* Feed */}
        {loading ? (
          <FeedSkeleton count={6} />
        ) : blasts.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#536471' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f1419', marginBottom: '8px' }}>
              {feedTab === 'following' ? "You aren't following anyone yet" : "No blasts found"}
            </h3>
            <p style={{ fontSize: '0.95rem', maxWidth: '340px', margin: '0 auto', lineHeight: '1.4' }}>
              {feedTab === 'following' 
                ? "Find talented Tanzanian creators on Explore and follow them to build your custom feed!" 
                : "Be the first to share your thoughts, music, or films with the world!"}
            </p>
            {feedTab === 'following' && (
              <button onClick={() => router.push('/explore')} style={{ marginTop: '16px', background: '#1d9bf0', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 20px', fontWeight: '800', cursor: 'pointer' }}>
                Go to Explore
              </button>
            )}
          </div>
        ) : blasts.map(blast => (
          <div key={blast.id} className="blast-card" onClick={() => { incrementView(blast.id); router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}/status/${blast.id}`); }}>
            <Avatar src={blast.profiles?.avatar_url || (blast.user_id === user?.id ? avatarUrl : null)} name={blast.profiles?.full_name || blast.profiles?.username || (blast.user_id === user?.id ? fullName : 'User')} size={40} onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}`); }} />
            <div className="blast-body">
              <div className="blast-user">
                <span className="name" onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}`); }} style={{ display: 'flex', alignItems: 'center' }}>
                  {blast.profiles?.full_name || blast.profiles?.username || (blast.user_id === user?.id ? fullName : 'User')} <VerificationBadge course={blast.profiles?.talent || (blast.user_id === user?.id ? profileData?.talent : null)} isVerified={blast.profiles?.is_verified || (blast.user_id === user?.id ? profileData?.is_verified : false)} />
                </span>
                <span className="handle" onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}`); }}>@{blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}</span>
                <span className="time">· {new Date(blast.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="content" style={{ fontSize: '1rem', lineHeight: '1.55', letterSpacing: '0.01em', marginBottom: (blast.media_url ? '12px' : '0'), wordBreak: 'break-word' }}>
                {blast.content}
              </div>

              {/* ── X-style Media Container ── */}
              {blast.media_url && (
                <div className="blast-media-container">
                  {blast.media_type === 'video' ? (
                    <video
                      src={blast.media_url}
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={blast.media_url}
                      alt="blast media"
                      loading="lazy"
                    />
                  )}
                </div>
              )}

              <div className="actions">
                <div className="action-item reply" onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || (blast.user_id === user?.id ? username : 'user')}/status/${blast.id}`); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>{blast.comments?.length || 0}</span>
                </div>
                <div className="action-item repost" onClick={e => { e.stopPropagation(); handleRepost(blast.id); }}
                  style={{ color: blast.reposts?.some(r => r.user_id === user?.id) ? '#00ba7c' : '' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                  <span>{blast.reposts?.length || 0}</span>
                </div>
                <div className="action-item like" onClick={e => { e.stopPropagation(); handleLike(blast.id); }}
                  style={{ color: blast.likes?.some(l => l.user_id === user?.id) ? '#f91880' : '' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  <span>{blast.likes?.length || 0}</span>
                </div>
                <div className="action-item views">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>{blast.views_count || 0}</span>
                </div>
                <div className="action-item share">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ══ SEARCH OVERLAY ══ */}
      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
          {/* Search bar header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'max(env(safe-area-inset-top), 12px) 16px 12px 16px', borderBottom: '1px solid #eff3f4' }}>
            <div onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} style={{ cursor: 'pointer', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#eff3f4', borderRadius: '20px', padding: '10px 16px', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search Sanaa Blast..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '1rem', color: '#0f1419', flex: 1 }}
              />
              {searchQuery && (
                <div onClick={() => { setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus(); }} style={{ cursor: 'pointer', color: '#536471' }}>✕</div>
              )}
            </div>
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!searchQuery ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#536471' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cfd9de" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f1419', marginBottom: '6px' }}>Search Sanaa Blast</div>
                <div style={{ fontSize: '0.9rem' }}>Search for people, blasts, and topics</div>
              </div>
            ) : searching ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#536471' }}>Searching...</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#536471' }}>
                <div style={{ fontWeight: '700', color: '#0f1419', marginBottom: '6px' }}>No results for "{searchQuery}"</div>
                <div style={{ fontSize: '0.9rem' }}>Try different keywords</div>
              </div>
            ) : (
              <div>
                {searchResults.map((item, idx) => (
                  item.type === 'profile' ? (
                    <div key={`p-${item.id}`} onClick={() => { setSearchOpen(false); router.push(`/${item.username}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #eff3f4', cursor: 'pointer' }}>
                      {item.avatar_url
                        ? <img src={item.avatar_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#cfd9de', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem', color: '#fff', flexShrink: 0 }}>
                            {(item.full_name || item.username || '?').charAt(0).toUpperCase()}
                          </div>
                      }
                      <div>
                        <div style={{ fontWeight: '800', color: '#0f1419', fontSize: '0.97rem' }}>{item.full_name || item.username}</div>
                        <div style={{ color: '#536471', fontSize: '0.88rem' }}>@{item.username}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={`b-${item.id}`} onClick={() => { setSearchOpen(false); incrementView(item.id); router.push(`/${item.profiles?.username || 'user'}/status/${item.id}`); }}
                      style={{ padding: '14px 16px', borderBottom: '1px solid #eff3f4', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {item.profiles?.avatar_url
                          ? <img src={item.profiles.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#cfd9de', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>
                              {(item.profiles?.full_name || item.profiles?.username || '?').charAt(0).toUpperCase()}
                            </div>
                        }
                        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f1419' }}>{item.profiles?.full_name || item.profiles?.username || 'User'}</span>
                        <span style={{ color: '#536471', fontSize: '0.85rem' }}>@{item.profiles?.username || 'user'}</span>
                        <span style={{ color: '#536471', fontSize: '0.8rem', marginLeft: 'auto' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: '#0f1419', fontSize: '0.97rem', lineHeight: '1.5', paddingLeft: '40px' }}>{item.content}</div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <TrendsSidebar />
      <MobileNav />

      {/* ── FAB: opens compose modal ── */}

      {/* ════ COMPOSE MODAL ════ */}
      {composeOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5000,
          backgroundColor: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            paddingTop: 'max(env(safe-area-inset-top), 16px)',
            borderBottom: '1px solid #2f3336',
          }}>
            <button onClick={() => setComposeOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', padding: '4px 0' }}>
              Cancel
            </button>
            <button onClick={handlePost} disabled={posting || (!composeText.trim() && !composeMedia)}
              style={{
                background: composeText.trim() || composeMedia ? '#1d9bf0' : '#0a4d7a',
                color: '#fff', border: 'none', borderRadius: '20px',
                padding: '7px 20px', fontWeight: '700', fontSize: '0.95rem',
                cursor: posting || (!composeText.trim() && !composeMedia) ? 'not-allowed' : 'pointer',
              }}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>

          {/* Compose area */}
          <div style={{ display: 'flex', gap: '12px', padding: '16px', flex: 1, alignItems: 'flex-start', overflowY: 'auto' }}>
            <Avatar src={avatarUrl} size={42} />
            <div style={{ flex: 1 }}>
              <textarea
                ref={composeRef}
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                placeholder="What's blasting today?"
                autoFocus
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  color: 'var(--text)', fontSize: '1.2rem', resize: 'none',
                  outline: 'none', lineHeight: 1.5, minHeight: '120px',
                  fontFamily: 'inherit',
                }}
              />
              {/* Media preview */}
              {composeMedia && (
                <div style={{ marginTop: '12px', position: 'relative', borderRadius: '16px', overflow: 'hidden', maxHeight: '280px' }}>
                  {composeMedia.type === 'video'
                    ? <video src={composeMedia.url} controls style={{ width: '100%', borderRadius: '16px', maxHeight: '280px', objectFit: 'cover' }} />
                    : <img src={composeMedia.url} alt="preview" style={{ width: '100%', borderRadius: '16px', maxHeight: '280px', objectFit: 'cover' }} />
                  }
                  <button onClick={() => setComposeMedia(null)}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Category selection */}
          <div style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
            {['General', 'News', 'Sports'].map(cat => (
              <button
                key={cat}
                onClick={() => setComposeCategory(cat)}
                style={{
                  background: composeCategory === cat ? '#1d9bf0' : 'transparent',
                  color: composeCategory === cat ? '#fff' : '#1d9bf0',
                  border: '1px solid #1d9bf0',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Bottom toolbar — Image & Video only */}
          <div style={{ borderTop: '1px solid #2f3336', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Image */}
            <button onClick={() => { mediaInputRef.current.accept = 'image/*'; mediaInputRef.current.click(); }}
              style={{ background: 'transparent', border: 'none', color: '#1d9bf0', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>

            {/* Video */}
            <button onClick={() => { mediaInputRef.current.accept = 'video/*'; mediaInputRef.current.click(); }}
              style={{ background: 'transparent', border: 'none', color: '#1d9bf0', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </button>

            {/* Single shared hidden input */}
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaPick} />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes drawerIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
