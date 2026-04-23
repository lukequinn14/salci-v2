-- Run after 002_analytics_tables.sql

alter table public.daily_salci_scores
  add column if not exists computed_at timestamptz default now();

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  computed_at timestamptz not null default now(),
  pitchers_computed integer not null default 0,
  pitchers_failed integer not null default 0,
  status text not null default 'success'
    check (status in ('success', 'partial', 'failed'))
);

alter table public.pipeline_runs enable row level security;

create policy "Public read pipeline_runs"
  on public.pipeline_runs for select using (true);
