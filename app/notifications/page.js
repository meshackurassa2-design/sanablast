'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import TrendsSidebar from '@/components/TrendsSidebar';

export default function NotificationsPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="feed">
        <header className="feed-header">
          <h2 style={{ padding: '15px 20px' }}>Notifications</h2>
          <div className="feed-tabs">
            <div className="tab active">All</div>
            <div className="tab">Verified</div>
            <div className="tab">Mentions</div>
          </div>
        </header>
        <div style={{ padding: '40px', textAlign: 'center', color: '#71767b' }}>
          <h3>Nothing to see here — yet</h3>
          <p>From likes to reposts and a whole lot more, this is where all the action happens.</p>
        </div>
      </main>
      <TrendsSidebar />
      <MobileNav />
    </div>
  );
}
