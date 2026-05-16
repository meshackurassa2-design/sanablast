'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Link from 'next/link';

export default function ProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [blasts, setBlasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTalent, setEditTalent] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!username) return;
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (pError || !profileData) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Try direct join first
      let { data: blastsData, error: bError } = await supabase
        .from('blasts')
        .select('*, likes(id, user_id), reposts(id, user_id)')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (bError && bError.message?.includes('relationship')) {
        console.warn('Profile DB relationships missing. Falling back to manual join.');
        // Fallback: Fetch blasts first
        const { data: bData, error: bErr } = await supabase.from('blasts').select('*').eq('user_id', profileData.id).order('created_at', { ascending: false });
        if (bErr) throw bErr;

        // Fetch interactions (only if there are blasts)
        const blastIds = bData.map(b => b.id);
        let lData = [];
        let rData = [];

        if (blastIds.length > 0) {
          const { data: ld } = await supabase.from('likes').select('*').in('blast_id', blastIds);
          const { data: rd } = await supabase.from('reposts').select('*').in('blast_id', blastIds);
          lData = ld || [];
          rData = rd || [];
        }

        blastsData = bData.map(b => ({
          ...b,
          likes: lData.filter(l => l.blast_id === b.id),
          reposts: rData.filter(r => r.blast_id === b.id),
        }));
      }

      setBlasts(blastsData || []);
    } catch (err) {
      console.error('Fetch profile/blasts failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = () => {
    setEditName(profile?.full_name || '');
    setEditBio(profile?.bio || '');
    setEditTalent(profile?.talent || '');
    setEditAvatarPreview(profile?.avatar_url || null);
    setEditCoverPreview(profile?.cover_url || null);
    setEditAvatarFile(null);
    setEditCoverFile(null);
    setEditOpen(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file, bucket, path) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;
      let coverUrl = profile?.cover_url || null;

      if (editAvatarFile) {
        const ext = editAvatarFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, editAvatarFile, { upsert: true, contentType: editAvatarFile.type });
        if (uploadErr) throw new Error('Avatar upload failed: ' + uploadErr.message);
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl + '?t=' + Date.now();
        console.log('Avatar URL:', avatarUrl);
      }

      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/cover.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, editCoverFile, { upsert: true, contentType: editCoverFile.type });
        if (uploadErr) throw new Error('Cover upload failed: ' + uploadErr.message);
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        coverUrl = urlData.publicUrl + '?t=' + Date.now();
        console.log('Cover URL:', coverUrl);
      }

      const updates = {
        full_name: editName.trim(),
        bio: editBio.trim(),
        talent: editTalent.trim(),
        avatar_url: avatarUrl,
        cover_url: coverUrl,
      };

      const { error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (updateErr) throw new Error('Profile update failed: ' + updateErr.message);

      // Immediately update local state so UI shows the new image
      setProfile(prev => ({ ...prev, ...updates }));
      setEditOpen(false);
    } catch (err) {
      console.error('Save error:', err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };


  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

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

  const Avatar = ({ src, size = 40, style = {} }) => (
    src
      ? <img src={src} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }} />
      : <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#2f3336', flexShrink: 0, ...style }} />
  );

  if (loading) return (
    <div style={{ background: '#ffffff', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f1419' }}>
      Loading profile...
    </div>
  );

  if (!profile) return (
    <div style={{ background: '#ffffff', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#0f1419', gap: '16px' }}>
      <div style={{ fontSize: '2rem', fontWeight: '900' }}>This account doesn't exist</div>
      <div style={{ color: '#536471' }}>Try searching for another.</div>
      <Link href="/" style={{ color: '#1d9bf0', textDecoration: 'none', fontWeight: '700', marginTop: '8px' }}>← Go Home</Link>
    </div>
  );

  return (
    <div className="layout">
      <Sidebar user={currentUser} />

      <main className="feed" style={{ paddingBottom: '80px', position: 'relative' }}>

        {/* ── Cover photo ── */}
        <div style={{ width: '100%', height: '160px', backgroundColor: '#cfd9de', position: 'relative', overflow: 'hidden' }}>
          {profile.cover_url
            ? <img src={profile.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', backgroundColor: '#cfd9de' }} />
          }
        </div>

        {/* ── Profile info block ── */}
        <div style={{ padding: '0 16px', position: 'relative' }}>
          {/* Avatar overlapping cover */}
          <div style={{ position: 'absolute', top: '-48px', left: '16px' }}>
            <Avatar src={profile.avatar_url} size={88} style={{ border: '4px solid #ffffff', borderRadius: '50%' }} />
          </div>

          {/* Edit / Follow button row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '14px', marginBottom: '58px' }}>
            {isOwnProfile ? (
              <button onClick={openEdit}
                style={{ border: '1px solid #cfd9de', borderRadius: '20px', background: '#ffffff', color: '#0f1419', padding: '7px 18px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>
                Edit profile
              </button>
            ) : (
              <button style={{ border: 'none', borderRadius: '20px', background: '#0f1419', color: '#ffffff', padding: '7px 18px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>
                Follow
              </button>
            )}
          </div>

          {/* Name / handle */}
          <div style={{ fontWeight: '900', fontSize: '1.25rem', color: '#0f1419', lineHeight: 1.2, display: 'flex', alignItems: 'center' }}>
            {profile.full_name || username} <VerificationBadge course={profile.talent} isVerified={profile.is_verified} />
          </div>
          <div style={{ color: '#536471', fontSize: '0.95rem', marginBottom: '8px' }}>@{profile.username}</div>
          {profile.talent && (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              backgroundColor: '#eff3f4', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.85rem', 
              fontWeight: '700', 
              color: 'var(--primary)',
              marginBottom: '10px'
            }}>
              {profile.talent}
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div style={{ color: '#0f1419', fontSize: '0.95rem', lineHeight: '1.4', marginBottom: '12px' }}>
              {profile.bio}
            </div>
          )}

          {/* Joined */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#71767b', fontSize: '0.85rem', marginBottom: '14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
            Joined {new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem' }}>
            <span><b style={{ color: '#0f1419', fontWeight: '700' }}>0</b> <span style={{ color: '#536471' }}>Following</span></span>
            <span><b style={{ color: '#0f1419', fontWeight: '700' }}>0</b> <span style={{ color: '#536471' }}>Followers</span></span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: '16px' }}>
          {['Posts', 'Replies', 'Media', 'Likes'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
              style={{
                flex: 1, padding: '14px 0', background: 'transparent', border: 'none',
                color: activeTab === tab.toLowerCase() ? '#0f1419' : '#536471',
                fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                borderBottom: activeTab === tab.toLowerCase() ? '3px solid #1d9bf0' : '3px solid transparent',
              }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Blasts ── */}
        {blasts.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#0f1419', marginBottom: '8px' }}>No posts yet</div>
            <div style={{ color: '#536471', fontSize: '0.95rem' }}>When {profile.full_name || username} blasts, it'll show up here.</div>
          </div>
        ) : (
          blasts.map(blast => (
            <div key={blast.id} onClick={() => window.location.href = `/${profile.username}/status/${blast.id}`}
              style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', cursor: 'pointer' }}>
              <Avatar src={profile.avatar_url} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f1419', display: 'flex', alignItems: 'center' }}>
                    {profile.full_name} <VerificationBadge course={profile.talent} isVerified={profile.is_verified} />
                  </span>
                  <span style={{ color: '#536471', fontSize: '0.85rem' }}>@{profile.username}</span>
                  <span style={{ color: '#536471', fontSize: '0.85rem' }}>· {new Date(blast.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ color: '#0f1419', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '10px', wordBreak: 'break-word' }}>{blast.content}</div>
                <div style={{ display: 'flex', gap: '28px', color: '#71767b' }}>
                  {[
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, count: 0 },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>, count: blast.reposts?.length || 0, activeColor: '#00ba7c', active: blast.reposts?.some(r => r.user_id === currentUser?.id) },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, count: blast.likes?.length || 0, activeColor: '#f91880', active: blast.likes?.some(l => l.user_id === currentUser?.id) },
                    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, count: blast.views_count || 0 },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: item.active ? item.activeColor : '#71767b' }}>
                      {item.icon}<span>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ════ EDIT PROFILE MODAL ════ */}
      {editOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setEditOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(91,112,131,0.5)', zIndex: 4000 }} />

          {/* Modal */}
          <div style={{
            position: 'fixed', inset: 0,
            margin: 'auto',
            width: '100%', maxWidth: '600px',
            height: 'fit-content', maxHeight: '92vh',
            overflowY: 'auto',
            backgroundColor: '#000000',
            borderRadius: '16px',
            zIndex: 4001,
            animation: 'fadeScaleIn 0.2s ease',
          }}>

            {/* ── Modal Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              position: 'sticky', top: 0, backgroundColor: '#000000', zIndex: 2,
              borderBottom: '1px solid #2f3336',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => setEditOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/>
                  </svg>
                </button>
                <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#e7e9ea' }}>Edit profile</span>
              </div>
              <button onClick={handleSave} disabled={saving}
                style={{
                  background: '#e7e9ea', color: '#000', border: 'none',
                  borderRadius: '20px', padding: '7px 20px',
                  fontWeight: '700', fontSize: '0.9rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* ── Cover Photo ── */}
            <div
              onClick={() => coverInputRef.current?.click()}
              style={{ width: '100%', height: '150px', position: 'relative', cursor: 'pointer', overflow: 'hidden', backgroundColor: '#1d2733' }}>
              {editCoverPreview
                ? <img src={editCoverPreview} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }} />
              }
              {/* Dim + camera icon */}
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(15,15,15,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                    <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                </div>
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </div>

            {/* ── Avatar row ── */}
            <div style={{ padding: '0 16px', position: 'relative', height: '52px' }}>
              {/* Avatar overlapping cover */}
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{ position: 'absolute', top: '-42px', left: '16px', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                  {editAvatarPreview
                    ? <img src={editAvatarPreview} alt="avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #000' }} />
                    : <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#333639', border: '4px solid #000' }} />
                  }
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                      <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  </div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>
            </div>

            {/* ── Form Fields ── */}
            <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Name */}
              <div style={{ border: '1px solid #333639', borderRadius: '6px', padding: '10px 14px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#1d9bf0', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={50}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#e7e9ea', fontSize: '1rem', padding: 0, paddingRight: '40px' }}
                />
                <span style={{ position: 'absolute', right: '14px', bottom: '10px', fontSize: '0.72rem', color: '#71767b' }}>
                  {editName.length}/50
                </span>
              </div>

              {/* Bio */}
              <div style={{ border: '1px solid #333639', borderRadius: '6px', padding: '10px 14px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#1d9bf0', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  maxLength={160}
                  rows={4}
                  placeholder="Tell people a little about yourself"
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#e7e9ea', fontSize: '1rem', resize: 'none', padding: 0, paddingBottom: '20px', lineHeight: 1.5 }}
                />
                <span style={{ position: 'absolute', right: '14px', bottom: '10px', fontSize: '0.72rem', color: '#71767b' }}>
                  {editBio.length}/160
                </span>
              </div>

              {/* Talent */}
              <div style={{ border: '1px solid #333639', borderRadius: '6px', padding: '10px 14px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#1d9bf0', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Unique Talent
                </label>
                <select 
                  value={editTalent} 
                  onChange={e => setEditTalent(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#e7e9ea', fontSize: '1rem', outline: 'none' }}
                >
                  <option value="" disabled>Select your talent</option>
                  <option value="Fine Arts & Painting">🎨 Fine Arts & Painting</option>
                  <option value="Music & Vocals">🎵 Music & Vocals</option>
                  <option value="Dance & Choreography">💃 Dance & Choreography</option>
                  <option value="Acting & Theater">🎭 Acting & Theater</option>
                  <option value="Photography & Film">📸 Photography & Film</option>
                  <option value="Poetry & Literature">✍️ Poetry & Literature</option>
                  <option value="Fashion & Design">👗 Fashion & Design</option>
                  <option value="Instrumentalists">🎸 Instrumentalists</option>
                </select>
              </div>

            </div>
          </div>
        </>
      )}

      <MobileNav />

      <style jsx global>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
