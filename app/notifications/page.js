'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';
import { FeedSkeleton } from '@/components/Loaders';
import Link from 'next/link';

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // Fetch user's blasts
      const { data: myBlasts } = await supabase
        .from('blasts')
        .select('id, content')
        .eq('user_id', user.id);

      const blastIds = myBlasts?.map(b => b.id) || [];
      const blastMap = {};
      myBlasts?.forEach(b => { blastMap[b.id] = b; });

      // Run engagement calls in parallel
      const promises = [
        supabase.from('follows').select('id, follower_id, created_at').eq('following_id', user.id)
      ];

      if (blastIds.length > 0) {
        promises.push(supabase.from('likes').select('id, user_id, blast_id, created_at').in('blast_id', blastIds));
        promises.push(supabase.from('reposts').select('id, user_id, blast_id, created_at').in('blast_id', blastIds));
        promises.push(supabase.from('blasts').select('id, user_id, content, reply_to, created_at').in('reply_to', blastIds));
      } else {
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
        promises.push(Promise.resolve({ data: [] }));
      }

      const [followsRes, likesRes, repostsRes, repliesRes] = await Promise.all(promises);

      const items = [];

      // Add follows
      (followsRes.data || []).forEach(f => {
        if (f.follower_id !== user.id) {
          items.push({
            id: `follow-${f.id}`,
            type: 'follow',
            actor_id: f.follower_id,
            created_at: f.created_at,
            text: 'followed you'
          });
        }
      });

      // Add likes
      (likesRes.data || []).forEach(l => {
        if (l.user_id !== user.id) {
          items.push({
            id: `like-${l.id}`,
            type: 'like',
            actor_id: l.user_id,
            target_id: l.blast_id,
            created_at: l.created_at,
            text: 'liked your post',
            subtext: blastMap[l.blast_id]?.content
          });
        }
      });

      // Add reposts
      (repostsRes.data || []).forEach(r => {
        if (r.user_id !== user.id) {
          items.push({
            id: `repost-${r.id}`,
            type: 'repost',
            actor_id: r.user_id,
            target_id: r.blast_id,
            created_at: r.created_at,
            text: 'reposted your post',
            subtext: blastMap[r.blast_id]?.content
          });
        }
      });

      // Add replies
      (repliesRes.data || []).forEach(rep => {
        if (rep.user_id !== user.id) {
          items.push({
            id: `reply-${rep.id}`,
            type: 'reply',
            actor_id: rep.user_id,
            target_id: rep.id,
            created_at: rep.created_at,
            text: 'replied to your post',
            subtext: rep.content,
            parent_blast_id: rep.reply_to
          });
        }
      });

      if (items.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Fetch profiles of all actors
      const actorIds = [...new Set(items.map(item => item.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, talent, is_verified')
        .in('id', actorIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = items
        .map(item => ({
          ...item,
          actor: profileMap[item.actor_id] || null
        }))
        .filter(item => item.actor) // Only keep items with a valid actor profile
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(enriched);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNotifications = () => {
    if (activeTab === 'All') return notifications;
    if (activeTab === 'Verified') {
      return notifications.filter(n => n.actor?.is_verified);
    }
    if (activeTab === 'Mentions') {
      // Show replies containing @username
      const myUsername = user?.user_metadata?.username || '';
      return notifications.filter(n => 
        n.type === 'reply' && 
        (n.subtext?.toLowerCase().includes(`@${myUsername.toLowerCase()}`) || n.subtext?.toLowerCase().includes('@mention'))
      );
    }
    return notifications;
  };

  const filtered = getFilteredNotifications();

  const Avatar = ({ src, name, size = 32, onClick }) => {
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill={badgeColor} style={{ marginLeft: '4px', flexShrink: 0 }}>
        <path d={pathD} />
      </svg>
    );
  };

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed">
        <header className="feed-header">
          <h2 style={{ padding: '15px 20px', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text)' }}>Notifications</h2>
          <div className="feed-tabs">
            <div className={`tab ${activeTab === 'All' ? 'active' : ''}`} onClick={() => setActiveTab('All')}>All</div>
            <div className={`tab ${activeTab === 'Verified' ? 'active' : ''}`} onClick={() => setActiveTab('Verified')}>Verified</div>
            <div className={`tab ${activeTab === 'Mentions' ? 'active' : ''}`} onClick={() => setActiveTab('Mentions')}>Mentions</div>
          </div>
        </header>

        {loading ? (
          <FeedSkeleton count={6} />
        ) : !user ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#536471' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f1419', marginBottom: '8px' }}>Log in to see notifications</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '16px' }}>Stay connected and see likes, comments, and follows instantly.</p>
            <button onClick={() => router.push('/login')} style={{ background: '#1d9bf0', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 20px', fontWeight: '800', cursor: 'pointer' }}>
              Log in
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#536471' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f1419', marginBottom: '8px' }}>
              {activeTab === 'All' && "Nothing to see here — yet"}
              {activeTab === 'Verified' && "No verified notifications"}
              {activeTab === 'Mentions' && "No mentions yet"}
            </h3>
            <p style={{ fontSize: '0.95rem', maxWidth: '320px', margin: '0 auto', lineHeight: '1.4' }}>
              {activeTab === 'All' && "From likes to reposts and a whole lot more, this is where all the action happens."}
              {activeTab === 'Verified' && "Likes, follows, and replies from verified accounts will show up here."}
              {activeTab === 'Mentions' && "When other users tag you using @username in their replies, they will appear here."}
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {filtered.map(item => {
              const handleCardClick = () => {
                if (item.type === 'follow') {
                  router.push(`/${item.actor.username}`);
                } else if (item.type === 'reply') {
                  router.push(`/${user?.user_metadata?.username || 'user'}/status/${item.parent_blast_id}`);
                } else {
                  router.push(`/${user?.user_metadata?.username || 'user'}/status/${item.target_id}`);
                }
              };

              return (
                <div key={item.id} onClick={handleCardClick} className="notification-card" style={{
                  display: 'flex',
                  padding: '16px 20px',
                  borderBottom: '1px solid #eff3f4',
                  cursor: 'pointer',
                  gap: '12px',
                  transition: 'background-color 0.2s',
                }}>
                  {/* Action Icon Section */}
                  <div style={{ width: '28px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
                    {item.type === 'like' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#f91880" stroke="#f91880" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    )}
                    {item.type === 'repost' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#00ba7c"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                    )}
                    {item.type === 'follow' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0" stroke="#1d9bf0" strokeWidth="1"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
                    )}
                    {item.type === 'reply' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d9bf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    )}
                  </div>

                  {/* Content Section */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Avatar 
                        src={item.actor.avatar_url} 
                        name={item.actor.full_name || item.actor.username} 
                        size={32} 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${item.actor.username}`);
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '0.95rem', color: '#0f1419', lineHeight: '1.4' }}>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${item.actor.username}`);
                        }}
                        style={{ fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      >
                        {item.actor.full_name || item.actor.username}
                        <VerificationBadge course={item.actor.talent} isVerified={item.actor.is_verified} />
                      </span>{' '}
                      <span style={{ color: '#536471' }}>{item.text}</span>
                    </div>

                    {item.subtext && (
                      <div style={{ 
                        marginTop: '8px', 
                        color: '#536471', 
                        fontSize: '0.92rem', 
                        lineHeight: '1.4',
                        background: item.type === 'reply' ? 'transparent' : '#f7f9f9',
                        padding: item.type === 'reply' ? '0' : '8px 12px',
                        borderRadius: '12px',
                        border: item.type === 'reply' ? 'none' : '1px solid #eff3f4',
                        wordBreak: 'break-word'
                      }}>
                        {item.subtext}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <TrendsSidebar />
      <MobileNav />
    </div>
  );
}
