'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';
import { FeedSkeleton } from '@/components/Loaders';

const VerificationBadge = ({ course, isVerified }) => {
  if (!isVerified) return null;
  const c = course?.toLowerCase() || '';
  let badgeColor = '#1d9bf0';
  let pathD = "M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z";

  if (c.includes('filming') || c.includes('video') || c.includes('television') || c.includes('movie')) {
    badgeColor = '#eab308';
    pathD = "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z";
  } else if (c.includes('music') || c.includes('audio') || c.includes('singer')) {
    badgeColor = '#f91880';
    pathD = "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z";
  } else if (c.includes('art') || c.includes('draw') || c.includes('paint')) {
    badgeColor = '#00ba7c';
    pathD = "M12 2C6.49 2 2 6.49 2 12s4.49 10 9.99 10C13.65 22 15 20.65 15 19s-1.35-3-3-3c-1.66 0-3-1.34-3-3s1.34-3 3-3h1.27c2.97 0 5.73-2.43 5.73-5.5C19 4.49 15.51 2 12 2zm-4.5 9c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8 9 8.67 9 9.5 8.33 11 7.5 11zm4.5-4C11.17 7 10.5 6.33 10.5 5.5S11.17 4 12 4s1.5.67 1.5 1.5S12.83 7 12 7zm4.5 4c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11z";
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={badgeColor} style={{ marginLeft: '4px', flexShrink: 0 }}>
      <path d={pathD} />
    </svg>
  );
};

  const Avatar = ({ src, name, size = 40, onClick }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return src
      ? <img src={src} alt="avatar" onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }} />
      : <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#cfd9de', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.4, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}>
          {initial}
        </div>
  };

export default function ExplorePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('Trending'); // Trending, News, Sports
  const [blasts, setBlasts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search Overlay States
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef(null);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data: pData } = await supabase.from('profiles').select('id, username, full_name, avatar_url').ilike('username', `%${q}%`).limit(5);
      const { data: bData } = await supabase.from('blasts').select('id, content, created_at, user_id, views_count').ilike('content', `%${q}%`).limit(10);
      
      const results = [];
      (pData || []).forEach(p => results.push({ ...p, type: 'profile' }));
      
      if (bData && bData.length > 0) {
        const userIds = [...new Set(bData.map(b => b.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds);
        const pMap = {};
        (profiles || []).forEach(p => { pMap[p.id] = p; });
        bData.forEach(b => results.push({ ...b, type: 'blast', profiles: pMap[b.user_id] || null }));
      }
      
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [tab]);

  const fetchTrending = async () => {
    setLoading(true);
    let query = supabase.from('blasts').select('*').order('views_count', { ascending: false }).limit(20);
    if (tab === 'News') query = query.eq('category', 'News');
    if (tab === 'Sports') query = query.eq('category', 'Sports');

    const { data: bData, error } = await query;
    if (error) { console.error('fetchTrending:', error.message); setLoading(false); return; }
    if (!bData || bData.length === 0) { setBlasts([]); setLoading(false); return; }

    // Enrich with profiles
    const userIds = [...new Set(bData.map(b => b.user_id))];
    const { data: profilesData } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', userIds);
    const profileMap = {};
    (profilesData || []).forEach(p => { profileMap[p.id] = p; });

    setBlasts(bData.map(b => ({ ...b, profiles: profileMap[b.user_id] || null })));
    setLoading(false);
  };

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed">
        <header className="feed-header">
          <div className="search-bar" onClick={openSearch} style={{ margin: '10px 20px', width: 'auto', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"/></svg>
            Search Sanaa Blast
          </div>
          <div className="feed-tabs">
            <div className={`tab ${tab === 'Trending' ? 'active' : ''}`} onClick={() => setTab('Trending')}>Trending</div>
            <div className={`tab ${tab === 'News' ? 'active' : ''}`} onClick={() => setTab('News')}>News</div>
            <div className={`tab ${tab === 'Sports' ? 'active' : ''}`} onClick={() => setTab('Sports')}>Sports</div>
          </div>
        </header>
        
        {loading ? (
          <FeedSkeleton count={6} />
        ) : blasts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#536471' }}>No trending blasts found in {tab}.</div>
        ) : (
          blasts.map(blast => (
            <div key={blast.id} className="blast-card" onClick={() => router.push(`/${blast.profiles?.username || 'user'}/status/${blast.id}`)}>
              <Avatar src={blast.profiles?.avatar_url} name={blast.profiles?.full_name || blast.profiles?.username} size={40} onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || 'user'}`); }} />
              <div className="blast-body">
                <div className="blast-user">
                  <span className="name" onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || 'user'}`); }} style={{ display: 'flex', alignItems: 'center' }}>
                    {blast.profiles?.full_name || blast.profiles?.username || 'User'} <VerificationBadge course={blast.profiles?.talent} isVerified={blast.profiles?.is_verified} />
                  </span>
                  <span className="handle" onClick={(e) => { e.stopPropagation(); router.push(`/${blast.profiles?.username || 'user'}`); }}>@{blast.profiles?.username || 'user'}</span>
                  <span className="time">· {new Date(blast.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="content" style={{ fontSize: '1rem', lineHeight: '1.55', letterSpacing: '0.01em', marginBottom: (blast.media_url ? '12px' : '0'), wordBreak: 'break-word' }}>
                  {blast.content}
                </div>
                {blast.media_url && (
                  <div className="media-container">
                    {blast.media_type === 'video'
                      ? <video src={blast.media_url} controls className="media-content" onClick={(e) => e.stopPropagation()} />
                      : <img src={blast.media_url} className="media-content" alt="Blast media" />
                    }
                  </div>
                )}
                
                {/* Minimal engagement stats for Explore */}
                <div style={{ display: 'flex', gap: '24px', marginTop: '12px', color: '#536471', fontSize: '0.85rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    {blast.likes_count || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    {blast.views_count || 0} Views
                  </div>
                  {blast.category && blast.category !== 'General' && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#1d9bf0', background: 'rgba(29, 155, 240, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      {blast.category}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
      <TrendsSidebar />
      <MobileNav />

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
                    <div key={`b-${item.id}`} onClick={() => { setSearchOpen(false); router.push(`/${item.profiles?.username || 'user'}/status/${item.id}`); }}
                      style={{ padding: '14px 16px', borderBottom: '1px solid #eff3f4', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {item.profiles?.avatar_url
                          ? <img src={item.profiles.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#cfd9de', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>
                              {(item.profiles?.full_name || item.profiles?.username || '?').charAt(0).toUpperCase()}
                            </div>
                        }
                        <div>
                          <span style={{ fontWeight: '700', color: '#0f1419', fontSize: '0.9rem' }}>{item.profiles?.full_name || item.profiles?.username}</span>
                          <span style={{ color: '#536471', fontSize: '0.8rem', marginLeft: '6px' }}>@{item.profiles?.username}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#0f1419', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.content}</div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
