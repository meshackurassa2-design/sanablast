'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{
          minHeight: '100dvh',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f1419', marginBottom: '8px' }}>
            This page couldn't load
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#536471', marginBottom: '24px', maxWidth: '320px', lineHeight: '1.4' }}>
            An unexpected error occurred. Reload to try again, or go back.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => reset()} style={{
              background: '#0f1419',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 24px',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}>
              Reload
            </button>
            <button onClick={() => window.history.back()} style={{
              background: 'transparent',
              color: '#0f1419',
              border: '1px solid #cfd9de',
              borderRadius: '20px',
              padding: '8px 24px',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}>
              Back
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
