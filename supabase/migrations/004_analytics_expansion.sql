-- Team offensive stats table (for matchup calculations)
create table if not exists public.team_offensive_stats (
  id uuid primary key default gen_random_uuid(),
  team_abbr text not null,
  season integer not null default 2026,
  k_pct real default 0.22,
  zone_contact_pct real default 0.82,
  chase_rate real default 0.30,
  babip real default 0.300,
  ops real default 0.710,
  updated_at timestamptz default now(),
  unique(team_abbr, season)
);

-- Pitch type breakdown per pitcher per day
create table if not exists public.pitcher_arsenal (
  id uuid primary key default gen_random_uuid(),
  pitcher_id integer references public.pitchers(id),
  game_date date not null,
  pitch_type text not null,
  usage_pct real,
  velocity real,
  stuff_plus real,
  whiff_rate real,
  updated_at timestamptz default now(),
  unique(pitcher_id, game_date, pitch_type)
);

-- User watchlists (for Phase C)
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  pitcher_id integer references public.pitchers(id),
  alert_threshold real default 70,
  created_at timestamptz default now(),
  unique(user_id, pitcher_id)
);

-- Enable RLS
alter table public.team_offensive_stats enable row level security;
alter table public.pitcher_arsenal enable row level security;
alter table public.watchlists enable row level security;

create policy "Public read team stats" on public.team_offensive_stats
  for select using (true);
create policy "Public read arsenal" on public.pitcher_arsenal
  for select using (true);
create policy "Users manage own watchlist" on public.watchlists
  for all using (auth.uid() = user_id);
