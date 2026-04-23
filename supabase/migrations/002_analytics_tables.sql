-- Run after 001_profiles.sql

create table public.pitchers (
  id integer primary key,
  name text not null,
  team text not null,
  handedness text not null check (handedness in ('L', 'R')),
  stuff_plus real default 100,
  location_plus real default 100,
  csw_pct real default 0.29,
  era real,
  whip real,
  k_per_9 real,
  updated_at timestamptz default now()
);

alter table public.pitchers enable row level security;
create policy "Public read pitchers" on public.pitchers for select using (true);

create table public.daily_salci_scores (
  id uuid primary key default gen_random_uuid(),
  pitcher_id integer references public.pitchers(id) on delete cascade,
  game_date date not null,
  salci_total real not null,
  stuff_score real not null,
  location_score real not null,
  matchup_score real not null,
  workload_score real not null,
  grade text not null,
  floor_ks integer not null,
  ceiling_ks integer not null,
  expected_ks real not null,
  buffer real not null,
  recommend_over boolean not null,
  book_line real,
  opponent text,
  is_home boolean,
  created_at timestamptz default now(),
  unique(pitcher_id, game_date)
);

alter table public.daily_salci_scores enable row level security;
create policy "Public read daily scores" on public.daily_salci_scores for select using (true);

create table public.game_predictions (
  id uuid primary key default gen_random_uuid(),
  pitcher_id integer references public.pitchers(id) on delete cascade,
  game_date date not null,
  predicted_floor integer not null,
  predicted_ceiling integer not null,
  predicted_expected_ks real not null,
  actual_ks integer,
  book_line real,
  recommend_over boolean not null,
  result text check (result in ('win', 'loss', 'push', 'pending')) default 'pending',
  created_at timestamptz default now()
);

alter table public.game_predictions enable row level security;
create policy "Public read predictions" on public.game_predictions for select using (true);

-- Index for fast date-range queries
create index idx_daily_salci_game_date on public.daily_salci_scores(game_date desc);
create index idx_predictions_game_date on public.game_predictions(game_date desc);
