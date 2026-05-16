'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MobileNav() {
  const pathname = usePathname();
  const [username, setUsername] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', session.user.id)
        .single();
      if (data?.username) setUsername(data.username);
    });
  }, []);

  const navItems = [
    {
      label: 'Home', href: '/',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M21 9.5L12 2 3 9.5V21a1 1 0 0 0 1 1h6v-7h4v7h6a1 1 0 0 0 1-1V9.5z"/></svg>
    },
    {
      label: 'Messages', href: '/messages',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    },
    {
      label: 'Compose', href: '#compose',
      icon: <div className="nav-plus-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
    },
    {
      label: 'Notifications', href: '/notifications',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    },
    {
      label: 'Profile', href: username ? `/${username}` : '/login',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    },
  ];

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href) || (href !== '/login' && pathname === `/${username}` && href === `/${username}`);
  };

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        item.href === '#compose' ? (
          <button key={item.label} onClick={() => window.dispatchEvent(new CustomEvent('open-compose'))} style={{ background: 'transparent', border: 'none', padding: 0 }}>
            {item.icon}
          </button>
        ) : (
          <Link
            key={item.label}
            href={item.href}
            style={{
              color: isActive(item.href) ? '#1d9bf0' : '#71767b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 10px',
            }}
          >
            {item.icon}
          </Link>
        )
      ))}
    </nav>
  );
}
