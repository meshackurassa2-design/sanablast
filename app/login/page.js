'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [talent, setTalent] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let avatarUrl = '';
      if (isSignUp && avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        } else {
          console.error("Upload error:", uploadError);
        }
      }

      const { data, error } = isSignUp 
        ? await supabase.auth.signUp({ 
            email, 
            password,
            options: {
              data: {
                username: username.toLowerCase().replace(/\s/g, '_'),
                full_name: fullName,
                avatar_url: avatarUrl,
                talent: talent
              }
            }
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        alert(error.message);
      } else {
        // Force a hard reload to ensure middleware catches the new cookies
        window.location.href = '/';
      }
    } catch (err) {
      console.error("Auth error:", err);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="auth-box">
        <h2 style={{ fontSize: '2.5rem', marginBottom: '40px', textAlign: 'left', fontWeight: '900', color: '#0f1419', lineHeight: 1.1 }}>
          {isSignUp ? 'Join the\nExplosion.' : 'Sign in to\nSanaa Blast.'}
        </h2>
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isSignUp && (
            <div className="avatar-upload-container">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                id="avatar-upload" 
                style={{ display: 'none' }} 
              />
              <label htmlFor="avatar-upload" className="avatar-preview-circle">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#71767b">
                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M14.829 14.829a4.947 4.947 0 0 1-5.656 0l-1.414 1.414a6.933 6.933 0 0 0 8.485 0l-1.415-1.414zm-5.329-6.329h-2v2h2v-2zm6 0h-2v2h2v-2z"/>
                  </svg>
                )}
                <div className="overlay">
                   <span>+</span>
                </div>
              </label>
              <div className="upload-hint">Upload a profile picture</div>
            </div>
          )}
          
          {isSignUp && (
            <>
              <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="auth-input" required />
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="auth-input" required />
              <select value={talent} onChange={(e) => setTalent(e.target.value)} className="auth-input" required style={{ appearance: 'none' }}>
                <option value="" disabled>Choose your Unique Talent</option>
                <option value="Fine Arts & Painting">🎨 Fine Arts & Painting</option>
                <option value="Music & Vocals">🎵 Music & Vocals</option>
                <option value="Dance & Choreography">💃 Dance & Choreography</option>
                <option value="Acting & Theater">🎭 Acting & Theater</option>
                <option value="Photography & Film">📸 Photography & Film</option>
                <option value="Poetry & Literature">✍️ Poetry & Literature</option>
                <option value="Fashion & Design">👗 Fashion & Design</option>
                <option value="Instrumentalists">🎸 Instrumentalists</option>
              </select>
            </>
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" required />
          
          <button type="submit" className="blast-btn auth-submit" disabled={loading} style={{ marginTop: '30px' }}>
            {loading ? 'Entering...' : (isSignUp ? 'Join the Explosion' : 'Sign in')}
          </button>
        </form>

        <p className="auth-toggle" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </p>
      </div>
      <style jsx>{`
        .login-container {
          background-color: #ffffff;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .auth-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }
        .avatar-upload-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 10px;
        }
        .avatar-preview-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px dashed #333639;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          position: relative;
          background-color: #16181c;
          transition: border-color 0.2s;
        }
        .avatar-preview-circle:hover {
          border-color: #1d9bf0;
        }
        .avatar-preview-circle .overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .avatar-preview-circle:hover .overlay {
          opacity: 1;
        }
        .overlay span {
          color: white;
          font-size: 1.5rem;
          font-weight: bold;
        }
        .upload-hint {
          margin-top: 8px;
          color: #71767b;
          font-size: 0.85rem;
        }
        .auth-input {
          background-color: #eff3f4;
          border: 2px solid transparent;
          border-radius: 16px;
          padding: 18px 20px;
          color: #0f1419;
          font-size: 16px !important;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .auth-input:focus {
          border-color: #1d9bf0;
          background-color: #ffffff;
          outline: none;
        }
        .auth-submit {
          width: 100%;
          padding: 18px;
          font-size: 1.15rem;
          font-weight: 800;
          margin-top: 15px;
          border-radius: 30px;
          background-color: #0f1419;
          color: #ffffff;
          border: none;
          cursor: pointer;
        }
        .auth-submit:disabled {
          background-color: #536471;
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-toggle {
          margin-top: 30px;
          color: #536471;
          cursor: pointer;
          text-align: center;
          font-size: 1rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .auth-toggle:hover {
          color: #0f1419;
        }
      `}</style>
    </div>
  );
}
