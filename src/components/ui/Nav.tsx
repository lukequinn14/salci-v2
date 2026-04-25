'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, TrendingUp, Users, BarChart2, Zap, FlaskConical, LogOut, Crown, Target } from 'lucide-react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/types/user';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/picks', label: 'Picks', icon: Target },
  { href: '/pitchers', label: 'Pitchers', icon: TrendingUp },
  { href: '/hitters', label: 'Hitters', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/edge', label: 'Edge', icon: Zap },
  { href: '/lab', label: 'Lab', icon: FlaskConical, badge: 'PRO' },
];

const Nav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [overCount, setOverCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/picks/count')
      .then((r) => r.json() as Promise<{ count: number }>)
      .then(({ count }) => { if (count > 0) setOverCount(count); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) fetchTier(supabase, data.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTier(supabase, session.user.id);
      else setTier('free');
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTier = async (
    supabase: ReturnType<typeof createClient>,
    userId: string
  ) => {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    if (data) setTier(data.subscription_tier as SubscriptionTier);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '';

  return (
    <>
      {/* Top header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-400">SALCI</span>
            <span className="hidden text-xs text-zinc-500 sm:block">Strikeout Analytics</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Desktop nav links */}
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map(({ href, label, icon: Icon, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    pathname === href
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  )}
                >
                  <Icon size={15} />
                  {label}
                  {href === '/picks' && overCount !== null && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                      {overCount}
                    </span>
                  )}
                  {badge && (
                    <span className="rounded px-1 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                      {badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Auth section */}
            {user ? (
              <div className="flex items-center gap-2 border-l border-zinc-800 pl-3 ml-1">
                {tier === 'pro' && (
                  <Crown size={14} className="text-amber-400" />
                )}
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                  {initials}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  title="Sign out"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:block">Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-7">
          {navItems.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors',
                pathname === href
                  ? 'text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <div className="relative">
                <Icon size={16} />
                {href === '/picks' && overCount !== null && (
                  <span className="absolute -top-1 -right-2.5 rounded-full bg-emerald-500 px-1 text-[7px] font-bold text-zinc-950 leading-tight">
                    {overCount}
                  </span>
                )}
                {badge && !overCount && (
                  <span className="absolute -top-1 -right-2 rounded px-0.5 text-[7px] font-bold bg-amber-500/20 text-amber-400">
                    P
                  </span>
                )}
              </div>
              <span className="truncate w-full text-center">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Nav;
