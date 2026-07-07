-- Trade-review journal: persists "analiza zagrania" scorecards per user.
--
-- No migration runner is wired up for this project yet, so apply this by hand:
-- Supabase dashboard → SQL Editor → paste → Run. Idempotent (safe to re-run).
--
-- Access model: client-side writes via the anon key, isolated by RLS
-- (auth.uid() = user_id). No service-role key is needed or used.

create extension if not exists "pgcrypto";

create table if not exists public.trade_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  symbol        text,
  direction     text,          -- long | short | unclear
  timeframe     text,
  process_score int,           -- 0-100, decision quality (independent of outcome)
  outcome       text,          -- win | loss | open | unclear
  notes         text,
  scorecard     jsonb not null -- full TradeScorecard payload
);

create index if not exists trade_reviews_user_created_idx
  on public.trade_reviews (user_id, created_at desc);

alter table public.trade_reviews enable row level security;

-- Each user sees and mutates only their own rows.
drop policy if exists "trade_reviews_select_own" on public.trade_reviews;
create policy "trade_reviews_select_own"
  on public.trade_reviews for select
  using (auth.uid() = user_id);

drop policy if exists "trade_reviews_insert_own" on public.trade_reviews;
create policy "trade_reviews_insert_own"
  on public.trade_reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "trade_reviews_delete_own" on public.trade_reviews;
create policy "trade_reviews_delete_own"
  on public.trade_reviews for delete
  using (auth.uid() = user_id);
