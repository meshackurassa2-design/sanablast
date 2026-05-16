'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Link from 'next/link';

export default function VerificationPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [blastsCount, setBlastsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchVerificationData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchVerificationData = async () => {
    try {
      // Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData);

      // Fetch Blasts Count
      const { count: bCount } = await supabase
        .from('blasts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setBlastsCount(bCount || 0);

      // Fetch Followers Count
      const { count: fCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      
      setFollowersCount(fCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setProfile({ ...profile, is_verified: true });
      alert('Congratulations! You have earned your Verification Badge!');
    } catch (err) {
      alert('Error claiming badge: ' + err.message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return (
    <div className="layout">
      <Sidebar />
      <main className="feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: '#0f1419' }}>Loading...</h2>
      </main>
      <MobileNav />
    </div>
  );

  if (!user) return (
    <div className="layout">
      <Sidebar />
      <main className="feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ color: '#0f1419' }}>Sign in to view challenges</h2>
        <Link href="/login" className="blast-btn" style={{ textDecoration: 'none' }}>Go to Login</Link>
      </main>
      <MobileNav />
    </div>
  );

  // Challenges progress
  const hasAvatarBio = profile?.avatar_url && profile?.bio && profile.bio.length > 5;
  const hasCourse = profile?.talent && profile.talent.length > 0;
  const hasBlasts = blastsCount >= 3;
  const hasFollowers = followersCount >= 25;

  const isEligible = hasAvatarBio && hasCourse && hasBlasts && hasFollowers;

  return (
    <div className="layout">
      <Sidebar user={user} />
      
      <main className="feed" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f7f9f9' }}>
        <header className="feed-header" style={{ padding: '15px 20px', background: '#ffffff', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, color: '#0f1419', fontSize: '1.25rem', fontWeight: '900' }}>Verification Center</h2>
        </header>

        <div style={{ padding: '30px 20px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill={profile?.is_verified ? '#1d9bf0' : '#cfd9de'} style={{ marginBottom: '15px' }}>
              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z" />
            </svg>
            <h1 style={{ color: '#0f1419', fontSize: '2rem', fontWeight: '900', margin: '0 0 10px 0' }}>Get Verified</h1>
            <p style={{ color: '#536471', fontSize: '1.05rem', margin: 0 }}>
              Complete the challenges below to earn your exclusive career verification badge and stand out on Sanaa Blast.
            </p>
          </div>

          {profile?.is_verified ? (
            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '30px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</div>
              <h2 style={{ color: '#0f1419', marginTop: 0 }}>You are Verified!</h2>
              <p style={{ color: '#536471' }}>Your {profile.talent} badge is now active on your profile and posts.</p>
              <Link href={`/${profile.username}`} className="blast-btn" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '15px' }}>
                View Profile
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <ChallengeCard 
                title="Establish Identity" 
                desc="Add a profile picture and write a short bio so people know who you are."
                isDone={hasAvatarBio}
              />
              <ChallengeCard 
                title="Select a Career" 
                desc="Choose your unique talent/occupation in your profile settings to determine your badge color."
                isDone={hasCourse}
              />
              <ChallengeCard 
                title="Active Blaster" 
                desc={`Post at least 3 Blasts to the feed. (${blastsCount}/3)`}
                isDone={hasBlasts}
              />
              <ChallengeCard 
                title="Build a Network" 
                desc={`Gain 25 followers. (${followersCount}/25)`}
                isDone={hasFollowers}
              />

              <div style={{ marginTop: '30px', textAlign: 'center' }}>
                <button 
                  onClick={handleClaim}
                  disabled={!isEligible || claiming}
                  style={{
                    backgroundColor: isEligible ? '#0f1419' : '#cfd9de',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: '30px',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: isEligible ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                    width: '100%'
                  }}
                >
                  {claiming ? 'Claiming...' : (isEligible ? 'Claim Verification Badge' : 'Complete all challenges to claim')}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
      <MobileNav />
    </div>
  );
}

const ChallengeCard = ({ title, desc, isDone }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    padding: '20px', 
    backgroundColor: '#ffffff', 
    borderRadius: '16px', 
    border: `1px solid ${isDone ? '#00ba7c' : 'var(--border)'}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  }}>
    <div style={{ 
      width: '32px', height: '32px', borderRadius: '50%', 
      backgroundColor: isDone ? '#00ba7c' : '#eff3f4',
      color: isDone ? '#ffffff' : '#536471',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginRight: '15px', flexShrink: 0
    }}>
      {isDone ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cfd9de' }}></div>
      )}
    </div>
    <div style={{ flex: 1 }}>
      <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#0f1419' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#536471', lineHeight: '1.4' }}>{desc}</p>
    </div>
  </div>
);
