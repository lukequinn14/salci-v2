'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface WatchlistButtonProps {
  pitcherId: number;
  size?: 'sm' | 'md';
}

const WatchlistButton = ({ pitcherId, size = 'sm' }: WatchlistButtonProps) => {
  const router = useRouter();
  const [watched, setWatched] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setReady(true); return; }
      setUserId(data.user.id);
      supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('pitcher_id', pitcherId)
        .maybeSingle()
        .then(({ data: row }) => {
          setWatched(!!row);
          setReady(true);
        });
    });
  }, [pitcherId]);

  const toggle = async () => {
    if (!userId) { router.push('/login'); return; }
    const supabase = createClient();
    if (watched) {
      await supabase.from('watchlists').delete().eq('user_id', userId).eq('pitcher_id', pitcherId);
      setWatched(false);
    } else {
      await supabase.from('watchlists').upsert({ user_id: userId, pitcher_id: pitcherId });
      setWatched(true);
    }
  };

  if (!ready) return null;

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`flex items-center justify-center rounded-full transition-colors ${
        size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
      } ${watched ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'}`}
    >
      <Star size={size === 'sm' ? 14 : 16} fill={watched ? 'currentColor' : 'none'} />
    </button>
  );
};

export default WatchlistButton;
