'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function GlobalCompose() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [composeText, setComposeText] = useState('');
  const [composeMedia, setComposeMedia] = useState(null);
  const [composeCategory, setComposeCategory] = useState('General');
  const [posting, setPosting] = useState(false);
  const composeRef = useRef(null);
  const mediaInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfileData(data); });
  }, [user]);

  useEffect(() => {
    const openCompose = () => {
      if (!user) { window.location.href = '/login'; return; }
      setComposeText('');
      setComposeMedia(null);
      setComposeCategory('General');
      setOpen(true);
      setTimeout(() => composeRef.current?.focus(), 80);
    };
    window.addEventListener('open-compose', openCompose);
    return () => window.removeEventListener('open-compose', openCompose);
  }, [user]);

  const handleMediaPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setComposeMedia({ file, url, type });
  };

  const handlePost = async () => {
    if (!user || posting) return;
    if (!composeText.trim() && !composeMedia) return;
    setPosting(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      if (composeMedia?.file) {
        const ext = composeMedia.file.name.split('.').pop();
        const path = `${user.id}/blast_${Date.now()}.${ext}`;
        await supabase.storage.from('avatars').upload(path, composeMedia.file, { upsert: true });
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        mediaUrl = data.publicUrl;
        mediaType = composeMedia.type;
      }
      const { error } = await supabase.from('blasts').insert([{
        content: composeText.trim(),
        user_id: user.id,
        category: composeCategory,
        ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
      }]);
      if (error) throw error;
      setOpen(false);
      setComposeText('');
      setComposeMedia(null);
      // Refresh the feed if on home page
      window.dispatchEvent(new CustomEvent('blast-posted'));
    } catch (err) {
      alert('Post failed: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  if (!open) return null;

  const avatarUrl = profileData?.avatar_url;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      backgroundColor: '#ffffff',
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #eff3f4',
      }}>
        <button onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 'none', color: '#0f1419', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', padding: '4px 0' }}>
          Cancel
        </button>
        <button
          onClick={handlePost}
          disabled={posting || (!composeText.trim() && !composeMedia)}
          style={{
            background: (composeText.trim() || composeMedia) && !posting ? '#1d9bf0' : '#a0cdf5',
            color: '#fff', border: 'none', borderRadius: '20px',
            padding: '8px 22px', fontWeight: '700', fontSize: '0.95rem',
            cursor: (composeText.trim() || composeMedia) && !posting ? 'pointer' : 'not-allowed',
          }}>
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>

      {/* Compose area */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px', flex: 1, alignItems: 'flex-start', overflowY: 'auto' }}>
        {avatarUrl
          ? <img src={avatarUrl} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#cfd9de', flexShrink: 0 }} />
        }
        <div style={{ flex: 1 }}>
          <textarea
            ref={composeRef}
            value={composeText}
            onChange={e => setComposeText(e.target.value)}
            placeholder="What's blasting today?"
            autoFocus
            style={{
              width: '100%', background: 'transparent', border: 'none',
              color: '#0f1419', fontSize: '1.2rem', resize: 'none',
              outline: 'none', lineHeight: 1.5, minHeight: '120px',
              fontFamily: 'inherit',
            }}
          />
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

      {/* Category chips */}
      <div style={{ padding: '0 16px 10px', display: 'flex', gap: '8px' }}>
        {['General', 'News', 'Sports'].map(cat => (
          <button key={cat} onClick={() => setComposeCategory(cat)} style={{
            background: composeCategory === cat ? '#1d9bf0' : 'transparent',
            color: composeCategory === cat ? '#fff' : '#1d9bf0',
            border: '1px solid #1d9bf0',
            borderRadius: '20px', padding: '4px 14px',
            fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
          }}>{cat}</button>
        ))}
      </div>

      {/* Bottom toolbar */}
      <div style={{ borderTop: '1px solid #eff3f4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => { mediaInputRef.current.accept = 'image/*'; mediaInputRef.current.click(); }}
          style={{ background: 'transparent', border: 'none', color: '#1d9bf0', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button onClick={() => { mediaInputRef.current.accept = 'video/*'; mediaInputRef.current.click(); }}
          style={{ background: 'transparent', border: 'none', color: '#1d9bf0', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaPick} />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
