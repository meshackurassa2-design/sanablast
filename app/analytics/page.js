'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [timeframe, setTimeframe] = useState(7);
  const [blasts, setBlasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ views: 0, likes: 0, replies: 0, reposts: 0, blasts: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) fetchAnalytics();
    else setLoading(false);
  }, [user, timeframe]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - timeframe);

    // Step 1: fetch user's blasts in timeframe
    const { data: bData } = await supabase
      .from('blasts')
      .select('id, content, created_at, views_count, media_url')
      .eq('user_id', user.id)
      .gte('created_at', dateLimit.toISOString())
      .order('created_at', { ascending: false });

    if (!bData || bData.length === 0) {
      setBlasts([]);
      setStats({ views: 0, likes: 0, replies: 0, reposts: 0, blasts: 0 });
      setLoading(false);
      return;
    }

    const blastIds = bData.map(b => b.id);

    // Step 2: fetch engagement in parallel
    const [likesRes, repliesRes, repostsRes] = await Promise.all([
      supabase.from('likes').select('id, blast_id').in('blast_id', blastIds),
      supabase.from('blasts').select('id, reply_to').in('reply_to', blastIds),
      supabase.from('reposts').select('id, blast_id').in('blast_id', blastIds),
    ]);

    const likesMap = {};
    const repliesMap = {};
    const repostsMap = {};
    (likesRes.data || []).forEach(l => { likesMap[l.blast_id] = (likesMap[l.blast_id] || 0) + 1; });
    (repliesRes.data || []).forEach(r => { repliesMap[r.reply_to] = (repliesMap[r.reply_to] || 0) + 1; });
    (repostsRes.data || []).forEach(r => { repostsMap[r.blast_id] = (repostsMap[r.blast_id] || 0) + 1; });

    const enriched = bData.map(b => ({
      ...b,
      likesCount: likesMap[b.id] || 0,
      repliesCount: repliesMap[b.id] || 0,
      repostsCount: repostsMap[b.id] || 0,
    }));

    const totals = enriched.reduce((acc, b) => ({
      views: acc.views + (b.views_count || 0),
      likes: acc.likes + b.likesCount,
      replies: acc.replies + b.repliesCount,
      reposts: acc.reposts + b.repostsCount,
      blasts: acc.blasts + 1,
    }), { views: 0, likes: 0, replies: 0, reposts: 0, blasts: 0 });

    setBlasts(enriched.sort((a, b) => (b.likesCount + (b.views_count || 0)) - (a.likesCount + (a.views_count || 0))));
    setStats(totals);
    setLoading(false);
  };

  const StatCard = ({ label, value, color }) => (
    <div style={{ background: '#ffffff', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e7ecef', flex: 1, minWidth: 0, textAlign: 'center' }}>
      <div style={{ color: '#536471', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: color || '#0f1419', fontSize: '1.9rem', fontWeight: '900', lineHeight: 1 }}>{value.toLocaleString()}</div>
    </div>
  );

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f7f9f9' }}>
        <header className="feed-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 16px', background: '#ffffff' }}>
          <div onClick={() => router.back()} style={{ cursor: 'pointer', padding: '10px 0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f1419', margin: 0 }}>Analytics</h2>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>
          {/* Timeframe tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }, { label: '1yr', days: 365 }].map(({ label, days }) => (
              <button key={days} onClick={() => setTimeframe(days)} style={{
                padding: '8px 18px', borderRadius: '20px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem',
                border: timeframe === days ? '2px solid #0f1419' : '1.5px solid #cfd9de',
                background: timeframe === days ? '#0f1419' : 'transparent',
                color: timeframe === days ? '#ffffff' : '#536471',
                transition: 'all 0.15s',
              }}>
                Last {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#536471', marginTop: '60px', fontSize: '1rem' }}>Loading analytics...</div>
          ) : (
            <>
              {/* 2-col: Blasts + Views */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <StatCard label="Blasts" value={stats.blasts} color="#0f1419" />
                <StatCard label="Views" value={stats.views} color="#1d9bf0" />
              </div>
              {/* 3-col: Likes + Replies + Reposts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '28px' }}>
                <StatCard label="Likes" value={stats.likes} color="#f91880" />
                <StatCard label="Replies" value={stats.replies} color="#1d9bf0" />
                <StatCard label="Reposts" value={stats.reposts} color="#00ba7c" />
              </div>

              {/* Top blasts */}
              <h3 style={{ margin: '0 0 14px 0', color: '#0f1419', fontSize: '1.1rem', fontWeight: '900' }}>
                Top Blasts · Last {timeframe === 365 ? '1 year' : `${timeframe} days`}
              </h3>
              {blasts.length === 0 ? (
                <div style={{ color: '#536471', textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e7ecef' }}>
                  No posts in this timeframe yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {blasts.slice(0, 5).map((blast, i) => (
                    <div key={blast.id} style={{ cursor: 'pointer', padding: '16px', borderRadius: '14px', border: '1px solid #e7ecef', background: '#ffffff', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i === 0 ? '#0f1419' : '#f7f9f9', color: i === 0 ? '#fff' : '#536471', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.85rem', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.95rem', color: '#0f1419', marginBottom: '10px', wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {blast.content || (blast.media_url ? '📷 Media' : 'Empty blast')}
                        </div>
                        <div style={{ display: 'flex', gap: '14px', color: '#536471', fontSize: '0.83rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            {blast.views_count || 0}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f91880' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            {blast.likesCount}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#00ba7c' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                            {blast.repostsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
