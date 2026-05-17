'use client';
import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade-out after 1.5s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    // Fully hide after fade completes
    const hideTimer = setTimeout(() => setVisible(false), 1900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.4s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Logo icon */}
      <div style={{
        width: 96,
        height: 96,
        borderRadius: 24,
        background: '#0f1419',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 8px 32px rgba(15,20,25,0.18)',
      }}>
        {/* Lightning bolt / SB icon */}
        <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
          <polygon
            points="32,4 16,28 26,28 22,50 38,26 28,26"
            fill="#1d9bf0"
          />
        </svg>
      </div>

      {/* App name */}
      <div style={{
        fontSize: '2rem',
        fontWeight: 900,
        color: '#0f1419',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        fontFamily: 'Outfit, sans-serif',
      }}>
        Sanaa Blast
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 8,
        fontSize: '0.95rem',
        fontWeight: 500,
        color: '#536471',
        letterSpacing: '0.04em',
        fontFamily: 'Outfit, sans-serif',
      }}>
        The Creative Explosion
      </div>

      {/* Animated loading dots at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        display: 'flex',
        gap: 8,
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#1d9bf0',
              animation: `splash-dot 1s ${i * 0.15}s infinite ease-in-out both`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
