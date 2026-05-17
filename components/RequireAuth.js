'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  const normalizedPath = pathname ? pathname.replace(/\/$/, '') : '';
  const isLoginPage = normalizedPath === '/login';

  useEffect(() => {
    if (isLoginPage) {
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
  }, [pathname, isLoginPage]);

  if (loading && !isLoginPage) {
    return (
      <div style={{ minHeight: '100dvh', background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      </div>
    );
  }

  return isAuthenticated || isLoginPage ? children : null;
}
