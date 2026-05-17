'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TrendsSidebar() {
  const neutralAvatar = { background: '#2f3336' };
  
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingBlasts, setTrendingBlasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    fetchSuggestedUsers();
    fetchTrendingBlasts();

    // Listen for changes in blasts to update trending in real time
    const channel = supabase
      .channel('realtime_trends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blasts' }, fetchTrendingBlasts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchTrendingBlasts)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  const fetchSuggestedUsers = async () => {
    // Show cached instantly
    try {
      const c = localStorage.getItem('sb_suggested_users');
      if (c) setSuggestedUsers(JSON.parse(c));
    } catch(_) {}
    try {
      let query = supabase.from('profiles').select('id, username, full_name, avatar_url').limit(10);
      const { data, error } = await query;
      if (!error && data) {
        let filtered = data;
        if (currentUser) {
          filtered = data.filter(p => p.id !== currentUser.id);
          const { data: followsData } = await supabase.from('follows').select('following_id').eq('follower_id', currentUser.id);
          const followingIds = new Set(followsData?.map(f => f.following_id) || []);
          filtered = filtered.filter(p => !followingIds.has(p.id));
        }
        const result = filtered.slice(0, 3);
        setSuggestedUsers(result);
        try { localStorage.setItem('sb_suggested_users', JSON.stringify(result)); } catch(_) {}
      }
    } catch (err) {}
  };

  const fetchTrendingBlasts = async () => {
    // Show cached instantly
    try {
      const c = localStorage.getItem('sb_trending_blasts');
      if (c) setTrendingBlasts(JSON.parse(c));
    } catch(_) {}
    try {
      // Step 1: fetch blasts
      const { data: bData, error } = await supabase
        .from('blasts')
        .select('id, content, user_id, created_at, reply_to')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !bData || bData.length === 0) return;

      const blastIds = bData.map(b => b.id);
      const userIds = [...new Set(bData.map(b => b.user_id).filter(Boolean))];

      // Step 2: fetch profiles + engagement in parallel
      const [profilesRes, likesRes, repostsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds),
        supabase.from('likes').select('id, blast_id').in('blast_id', blastIds),
        supabase.from('reposts').select('id, blast_id').in('blast_id', blastIds),
      ]);

      const profMap = {};
      (profilesRes.data || []).forEach(p => { profMap[p.id] = p; });

      const enriched = bData.map(b => ({
        ...b,
        profiles: profMap[b.user_id] || null,
        likes: (likesRes.data || []).filter(l => l.blast_id === b.id),
        reposts: (repostsRes.data || []).filter(r => r.blast_id === b.id),
      }));

      const scored = enriched
        .filter(b => !b.reply_to)
        .map(b => ({ ...b, score: (b.likes?.length || 0) * 2 + (b.reposts?.length || 0) * 3 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setTrendingBlasts(scored);
      try { localStorage.setItem('sb_trending_blasts', JSON.stringify(scored)); } catch(_) {}
    } catch (err) {}
  };

  const handleFollow = async (id) => {
    if (!currentUser) { alert('Please log in to follow users'); return; }
    try {
      const { error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: id });
      if (error) {
        console.error('Follow Error:', error);
        alert(`Follow failed: ${error.message || JSON.stringify(error)}`);
        return;
      }
      setSuggestedUsers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert(`Follow exception: ${err.message}`);
    }
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

  return (
    <aside className="right-sidebar">
      <div className="search-bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"/></svg>
        Search Blasts
      </div>

      <div className="trending-box">
        <h3>Trends for you</h3>
        {trendingBlasts.length > 0 ? trendingBlasts.map(blast => (
          <div key={blast.id} className="trend-item" onClick={() => window.location.href = `/${blast.profiles?.username || (blast.user_id === currentUser?.id ? currentUser?.user_metadata?.username : 'user')}/status/${blast.id}`} style={{ cursor: 'pointer' }}>
            <div className="trend-label">Trending · {(blast.likes?.length || 0) + (blast.reposts?.length || 0)} Interactions</div>
            <div className="trend-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold', margin: '2px 0', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
              {blast.content?.substring(0, 30)}{blast.content?.length > 30 ? '...' : ''}
            </div>
            <div className="trend-count" style={{ display: 'flex', alignItems: 'center' }}>
              by @{blast.profiles?.username || (blast.user_id === currentUser?.id ? currentUser?.user_metadata?.username : 'user')} <VerificationBadge course={blast.profiles?.talent} isVerified={blast.profiles?.is_verified} />
            </div>
          </div>
        )) : (
          <div className="trend-item"><div className="trend-label">No trends yet</div></div>
        )}
      </div>

      <div className="follow-box">
        <h3>Who to follow</h3>
        {suggestedUsers.length > 0 ? suggestedUsers.map(profile => (
          <div key={profile.id} className="follow-item" onClick={() => window.location.href = `/${profile.username}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div className="avatar" style={{ ...neutralAvatar, width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#cfd9de', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
                {(profile.full_name || profile.username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name" style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                {profile.full_name || profile.username || 'User'} <VerificationBadge course={profile.talent} isVerified={profile.is_verified} />
              </div>
              <div className="handle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>
                @{profile.username || 'user'}
              </div>
            </div>
            <button className="follow-btn" onClick={(e) => { e.stopPropagation(); handleFollow(profile.id); }}>Follow</button>
          </div>
        )) : (
          <div className="follow-item"><div className="name">No more users to follow</div></div>
        )}
      </div>
    </aside>
  );
}
