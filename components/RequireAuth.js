'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      setIsAuthenticated(true);
      return;
    }

    // Delay briefly to allow Supabase to read localStorage
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          window.location.replace('/login');
        } else {
          setIsAuthenticated(true);
          setLoading(false);
        }
      });
    }, 50);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        window.location.replace('/login');
      } else {
        setIsAuthenticated(true);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (loading && pathname !== '/login') {
    return (
      <div style={{ minHeight: '100dvh', background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="#1d9bf0" style={{ marginBottom: '20px', animation: 'pulse 1.5s infinite' }}>
          <path d="M3 7h11l-1.5 4H6l-1.5 4h7.5l-1.5 4H2l1.5-4h4l1.5-4H3.5L5 7z" />
          <path d="M13 7h9l-1.5 4h-5l-1.5 4h5l-1.5 4h-5l-1.5 4h9L21 19l-1.5-4h5L22 11l-1.5-4z" />
        </svg>
        <style>{`@keyframes pulse { 0% { opacity: 0.6; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0.6; transform: scale(0.98); } }`}</style>
      </div>
    );
  }

  return isAuthenticated || pathname === '/login' ? children : null;
}
