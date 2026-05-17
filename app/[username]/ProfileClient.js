'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Link from 'next/link';

export default function ProfileClient() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [blasts, setBlasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
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
    supabase.auth.getSession().then(({ data: { session } }) => setCurrentUser(session?.user ?? null));
  }, []);

  useEffect(() => { if (username) fetchProfile(); }, [username]);

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: pError } = await supabase.from('profiles').select('*').eq('username', username).single();
      if (pError || !profileData) { setProfile(null); setLoading(false); return; }
      setProfile(profileData);
      const { data: bData } = await supabase.from('blasts').select('*').eq('user_id', profileData.id).order('created_at', { ascending: false });
      const blastIds = (bData || []).map(b => b.id);
      const [{ data: lData }, { data: rData }] = await Promise.all([
        supabase.from('likes').select('*').in('blast_id', blastIds.length ? blastIds : ['none']),
        supabase.from('reposts').select('*').in('blast_id', blastIds.length ? blastIds : ['none']),
      ]);
      setBlasts((bData || []).map(b => ({ ...b, likes: (lData||[]).filter(l=>l.blast_id===b.id), reposts: (rData||[]).filter(r=>r.blast_id===b.id) })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openEdit = () => { setEditName(profile?.full_name||''); setEditBio(profile?.bio||''); setEditTalent(profile?.talent||''); setEditAvatarPreview(profile?.avatar_url||null); setEditCoverPreview(profile?.cover_url||null); setEditAvatarFile(null); setEditCoverFile(null); setEditOpen(true); };
  const handleAvatarChange = (e) => { const f=e.target.files[0]; if(!f) return; setEditAvatarFile(f); setEditAvatarPreview(URL.createObjectURL(f)); };
  const handleCoverChange = (e) => { const f=e.target.files[0]; if(!f) return; setEditCoverFile(f); setEditCoverPreview(URL.createObjectURL(f)); };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;
      let coverUrl = profile?.cover_url || null;
      if (editAvatarFile) {
        const ext = editAvatarFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/avatar.${ext}`;
        await supabase.storage.from('avatars').upload(path, editAvatarFile, { upsert: true, contentType: editAvatarFile.type });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl + '?t=' + Date.now();
      }
      if (editCoverFile) {
        const ext = editCoverFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/cover.${ext}`;
        await supabase.storage.from('avatars').upload(path, editCoverFile, { upsert: true, contentType: editCoverFile.type });
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        coverUrl = urlData.publicUrl + '?t=' + Date.now();
      }
      const updates = { full_name: editName.trim(), bio: editBio.trim(), talent: editTalent.trim(), avatar_url: avatarUrl, cover_url: coverUrl };
      await supabase.from('profiles').update(updates).eq('id', currentUser.id);
      setProfile(prev => ({ ...prev, ...updates }));
      setEditOpen(false);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;
  const Avatar = ({ src, size = 40, style = {} }) => src
    ? <img src={src} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#cfd9de', flexShrink: 0, ...style }} />;

  const VerificationBadge = ({ course, isVerified }) => {
    if (!isVerified) return null;
    const c = course?.toLowerCase() || '';
    let color = '#1d9bf0';
    let d = "M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z";
    if (c.includes('music')||c.includes('singer')) { color='#f91880'; d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"; }
    else if (c.includes('art')||c.includes('paint')) { color='#00ba7c'; }
    return <svg width="18" height="18" viewBox="0 0 24 24" fill={color} style={{ marginLeft:'4px', flexShrink:0 }}><path d={d}/></svg>;
  };

  if (loading) return <div style={{ background:'#fff', minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>Loading profile...</div>;
  if (!profile) return <div style={{ background:'#fff', minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}><div style={{ fontSize:'2rem', fontWeight:'900' }}>This account doesn't exist</div><Link href="/" style={{ color:'#1d9bf0', textDecoration:'none', fontWeight:'700' }}>← Go Home</Link></div>;

  return (
    <div className="layout">
      <Sidebar user={currentUser} />
      <main className="feed" style={{ paddingBottom:'80px' }}>
        <div style={{ width:'100%', height:'160px', backgroundColor:'#cfd9de', overflow:'hidden' }}>
          {profile.cover_url ? <img src={profile.cover_url} alt="cover" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#667eea,#764ba2)' }} />}
        </div>
        <div style={{ padding:'0 16px', position:'relative' }}>
          <div style={{ position:'absolute', top:'-48px', left:'16px' }}>
            <Avatar src={profile.avatar_url} size={88} style={{ border:'4px solid #fff', borderRadius:'50%' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'14px', marginBottom:'58px' }}>
            {isOwnProfile
              ? <button onClick={openEdit} style={{ border:'1px solid #cfd9de', borderRadius:'20px', background:'#fff', color:'#0f1419', padding:'7px 18px', fontWeight:'700', cursor:'pointer' }}>Edit profile</button>
              : <button style={{ border:'none', borderRadius:'20px', background:'#0f1419', color:'#fff', padding:'7px 18px', fontWeight:'700', cursor:'pointer' }}>Follow</button>}
          </div>
          <div style={{ fontWeight:'900', fontSize:'1.25rem', color:'#0f1419', display:'flex', alignItems:'center' }}>{profile.full_name || username} <VerificationBadge course={profile.talent} isVerified={profile.is_verified} /></div>
          <div style={{ color:'#536471', fontSize:'0.95rem', marginBottom:'8px' }}>@{profile.username}</div>
          {profile.bio && <div style={{ color:'#0f1419', fontSize:'0.95rem', lineHeight:'1.4', marginBottom:'12px' }}>{profile.bio}</div>}
          <div style={{ display:'flex', gap:'20px', fontSize:'0.9rem' }}>
            <span><b style={{ color:'#0f1419' }}>0</b> <span style={{ color:'#536471' }}>Following</span></span>
            <span><b style={{ color:'#0f1419' }}>0</b> <span style={{ color:'#536471' }}>Followers</span></span>
          </div>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid #eff3f4', marginTop:'16px' }}>
          {['Posts','Replies','Media','Likes'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} style={{ flex:1, padding:'14px 0', background:'transparent', border:'none', color: activeTab===tab.toLowerCase() ? '#0f1419':'#536471', fontWeight:'700', fontSize:'0.95rem', cursor:'pointer', borderBottom: activeTab===tab.toLowerCase() ? '3px solid #1d9bf0':'3px solid transparent' }}>{tab}</button>
          ))}
        </div>

        {blasts.length === 0
          ? <div style={{ padding:'48px 16px', textAlign:'center', color:'#536471' }}>No posts yet</div>
          : blasts.map(blast => (
            <div key={blast.id} onClick={() => window.location.href=`/${profile.username}/status/${blast.id}`}
              style={{ padding:'14px 16px', borderBottom:'1px solid #eff3f4', display:'flex', gap:'12px', cursor:'pointer' }}>
              <Avatar src={profile.avatar_url} size={42} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:'800', color:'#0f1419', marginBottom:'4px' }}>{profile.full_name} <span style={{ color:'#536471', fontWeight:'400' }}>@{profile.username} · {new Date(blast.created_at).toLocaleDateString()}</span></div>
                <div style={{ color:'#0f1419', lineHeight:1.5 }}>{blast.content}</div>
                <div style={{ display:'flex', gap:'24px', color:'#71767b', marginTop:'10px', fontSize:'0.85rem' }}>
                  <span>💬 0</span>
                  <span>🔁 {blast.reposts?.length||0}</span>
                  <span>❤️ {blast.likes?.length||0}</span>
                  <span>👁 {blast.views_count||0}</span>
                </div>
              </div>
            </div>
          ))
        }
      </main>

      {editOpen && (
        <>
          <div onClick={() => setEditOpen(false)} style={{ position:'fixed', inset:0, backgroundColor:'rgba(91,112,131,0.5)', zIndex:4000 }} />
          <div style={{ position:'fixed', inset:0, margin:'auto', width:'100%', maxWidth:'600px', height:'fit-content', maxHeight:'92vh', overflowY:'auto', backgroundColor:'#000', borderRadius:'16px', zIndex:4001 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #2f3336', position:'sticky', top:0, background:'#000', zIndex:2 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
                <button onClick={() => setEditOpen(false)} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:'18px' }}>✕</button>
                <span style={{ fontWeight:'800', fontSize:'1.1rem', color:'#e7e9ea' }}>Edit profile</span>
              </div>
              <button onClick={handleSave} disabled={saving} style={{ background:'#e7e9ea', color:'#000', border:'none', borderRadius:'20px', padding:'7px 20px', fontWeight:'700', cursor:'pointer', opacity:saving?0.6:1 }}>{saving?'Saving…':'Save'}</button>
            </div>
            <div onClick={() => coverInputRef.current?.click()} style={{ width:'100%', height:'150px', cursor:'pointer', overflow:'hidden', backgroundColor:'#1d2733', position:'relative' }}>
              {editCoverPreview ? <img src={editCoverPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#0f0c29,#302b63)' }} />}
              <div style={{ position:'absolute', inset:0, backgroundColor:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ color:'#fff', fontSize:'24px' }}>📷</span>
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleCoverChange} />
            </div>
            <div style={{ padding:'0 16px', position:'relative', height:'52px' }}>
              <div onClick={() => avatarInputRef.current?.click()} style={{ position:'absolute', top:'-42px', left:'16px', cursor:'pointer' }}>
                <div style={{ position:'relative', width:'80px', height:'80px' }}>
                  {editAvatarPreview ? <img src={editAvatarPreview} style={{ width:'80px', height:'80px', borderRadius:'50%', objectFit:'cover', border:'4px solid #000' }} /> : <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:'#333', border:'4px solid #000' }} />}
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#fff' }}>📷</span></div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
              </div>
            </div>
            <div style={{ padding:'8px 16px 32px', display:'flex', flexDirection:'column', gap:'16px' }}>
              {[['Name', editName, setEditName, 50], ['Bio', editBio, setEditBio, 160]].map(([label, val, setter, max]) => (
                <div key={label} style={{ border:'1px solid #333', borderRadius:'6px', padding:'10px 14px' }}>
                  <label style={{ display:'block', fontSize:'0.72rem', color:'#1d9bf0', fontWeight:'600', marginBottom:'6px', textTransform:'uppercase' }}>{label}</label>
                  {label==='Bio'
                    ? <textarea value={val} onChange={e=>setter(e.target.value)} maxLength={max} rows={3} style={{ width:'100%', background:'transparent', border:'none', color:'#e7e9ea', fontSize:'1rem', resize:'none' }} />
                    : <input type="text" value={val} onChange={e=>setter(e.target.value)} maxLength={max} style={{ width:'100%', background:'transparent', border:'none', color:'#e7e9ea', fontSize:'1rem' }} />
                  }
                </div>
              ))}
              <div style={{ border:'1px solid #333', borderRadius:'6px', padding:'10px 14px' }}>
                <label style={{ display:'block', fontSize:'0.72rem', color:'#1d9bf0', fontWeight:'600', marginBottom:'6px', textTransform:'uppercase' }}>Unique Talent</label>
                <select value={editTalent} onChange={e=>setEditTalent(e.target.value)} style={{ width:'100%', background:'transparent', border:'none', color:'#e7e9ea', fontSize:'1rem' }}>
                  <option value="">Select your talent</option>
                  {['Fine Arts & Painting','Music & Vocals','Dance & Choreography','Acting & Theater','Photography & Film','Poetry & Literature','Fashion & Design','Instrumentalists'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
      <MobileNav />
    </div>
  );
}
