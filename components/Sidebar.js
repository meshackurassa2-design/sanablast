'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SBLogo = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="var(--primary)">
    {/* Stylized S */}
    <path d="M3 7h11l-1.5 4H6l-1.5 4h7.5l-1.5 4H2l1.5-4h4l1.5-4H3.5L5 7z" />
    {/* Stylized B */}
    <path d="M13 7h9l-1.5 4h-5l-1.5 4h5l-1.5 4h-5l-1.5 4h9L21 19l-1.5-4h5L22 11l-1.5-4z" />
  </svg>
);

export default function Sidebar({ user: propUser }) {
  const pathname = usePathname();

  // Synchronous session recovery from localStorage to resolve tab-change flashing
  const [sidebarUser, setSidebarUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('sb-xhegpgkyivzzdrqjwzoz-auth-token');
      if (token) {
        return JSON.parse(token)?.user || null;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = localStorage.getItem(key);
          if (val) return JSON.parse(val)?.user || null;
        }
      }
    } catch (e) {}
    return null;
  });

  // Keep state active in real-time
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSidebarUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const user = sidebarUser || propUser;

  const navItems = [
    { label: 'Home', href: '/', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 9.5L12 2 3 9.5V21a1 1 0 0 0 1 1h6v-7h4v7h6a1 1 0 0 0 1-1V9.5z"/></svg> },
    { label: 'Explore', href: '/explore', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { label: 'Notifications', href: '/notifications', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { label: 'Messages', href: '/messages', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label: 'Analytics', href: '/analytics', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { label: 'Verification', href: '/verification', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.73 0-1.41.192-2 .524C13.9 2.5 12.5 1.5 11 1.5s-2.9 1-3.59 2.524C6.82 3.69 6.14 3.5 5.41 3.5c-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.732 2.75 1.83 3.444C1.18 16.48 1.1 16.98 1.1 17.5c0 2.21 1.79 4 4 4 .9 0 1.73-.306 2.4-.82.97.98 2.3 1.57 3.75 1.57s2.78-.59 3.75-1.57c.67.514 1.5.82 2.4.82 2.21 0 4-1.79 4-4 0-.52-.08-1.02-.22-1.556 1.098-.694 1.83-1.984 1.83-3.444zm-11 5.5l-4-4 1.41-1.41 2.59 2.58 6.59-6.59 1.41 1.41-8 8z"/></svg> },
    { label: 'Profile', href: user ? `/${user.user_metadata?.username || 'profile'}` : '/login', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  return (
    <aside className="sidebar">
      <nav>
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {user ? (
        <button className="blast-btn" style={{ background: '#f4212e', borderRadius: '30px', marginTop: '20px' }} onClick={async () => { await supabase.auth.signOut(); }}>Log out</button>
      ) : (
        <Link href="/login" className="blast-btn" style={{ textAlign: 'center', textDecoration: 'none', background: 'var(--primary)', borderRadius: '30px', marginTop: '20px' }}>Log in</Link>
      )}
    </aside>
  );
}
