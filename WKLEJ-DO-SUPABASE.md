# Migracje do wklejenia w Supabase

**Gdzie:** https://supabase.com/dashboard/project/wkyssmlitsxgvslcyedf/sql/new
**Jak:** skopiuj cały blok SQL → wklej → **Run** → oczekiwany wynik: `Success. No rows returned`
**Bezpieczeństwo:** każdy blok jest idempotentny — można uruchomić wielokrotnie bez szkody.

> ⚠️ **Kolejność wdrożenia:** wklej migrację **zanim** odpowiadający jej kod
> trafi na `main` (auto-deploy). `consumeQuota()` fail-closed — kod bez
> migracji zwróci 503 na każdą analizę.

Status:

- ✅ `0002_ai_setup_usage.sql` — zastosowana (quota AI Trade Setup).
- ✅ `0003_trade_review_quota.sql` — zastosowana 2026-07-14 (limity: 5 analiz
  zagrań/dzień + 2 insighty/dzień); zweryfikowana na prodzie.
- ✅ `0004_trade_review_insights.sql` — zastosowana 2026-07-14 (tabela AI
  Insights z RLS); zweryfikowana na prodzie.

Po wykonaniu 0003: `follio.io/app/trade-review` wymaga logowania i ma limit
5 analiz dziennie na użytkownika; smoke-test wszystkich 4 rodzajów quoty
(generation / chat / trade_review / insight).

Po wykonaniu 0004: przycisk **Generate insights** na `/app/trade-review`
zaczyna działać (min. 3 zapisane analizy, 2 insighty/dzień).

Rollback 0003: nowe kolumny są nieszkodliwe (addytywne); starą wersję funkcji
przywraca ponowne wklejenie bloku z `supabase/migrations/0002_ai_setup_usage.sql`
(sekcja `create or replace function`).
Rollback 0004: `drop table public.trade_review_insights;` (kasuje historię
insightów — tylko w ostateczności).

---

## 0003 — quota trade-review + insights

```sql
begin;

alter table public.ai_setup_usage
  add column if not exists trade_reviews int not null default 0,
  add column if not exists insights      int not null default 0;

create or replace function public.consume_ai_setup_quota(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_day   date := (now() at time zone 'utc')::date;
  v_limit int;
  v_used  int;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;

  v_limit := case p_kind
    when 'generation'   then 10
    when 'chat'         then 30
    when 'trade_review' then 5
    when 'insight'      then 2
    else null
  end;
  if v_limit is null then
    raise exception 'unknown quota kind: %', p_kind;
  end if;

  insert into public.ai_setup_usage (user_id, day)
  values (v_user, v_day)
  on conflict (user_id, day) do nothing;

  if p_kind = 'generation' then
    update public.ai_setup_usage
       set generations = generations + 1, updated_at = now()
     where user_id = v_user and day = v_day and generations < v_limit
     returning generations into v_used;
  elsif p_kind = 'chat' then
    update public.ai_setup_usage
       set chat_messages = chat_messages + 1, updated_at = now()
     where user_id = v_user and day = v_day and chat_messages < v_limit
     returning chat_messages into v_used;
  elsif p_kind = 'trade_review' then
    update public.ai_setup_usage
       set trade_reviews = trade_reviews + 1, updated_at = now()
     where user_id = v_user and day = v_day and trade_reviews < v_limit
     returning trade_reviews into v_used;
  else
    update public.ai_setup_usage
       set insights = insights + 1, updated_at = now()
     where user_id = v_user and day = v_day and insights < v_limit
     returning insights into v_used;
  end if;

  if v_used is null then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;
  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_used);
end;
$$;

revoke all on function public.consume_ai_setup_quota(text) from public, anon;
grant execute on function public.consume_ai_setup_quota(text) to authenticated;

commit;
```

---

## 0004 — tabela AI Insights (meta-review)

```sql
  begin;
  
  create extension if not exists "pgcrypto";
  
  create table if not exists public.trade_review_insights (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now(),
    period_kind text not null check (period_kind in ('last_n', 'last_7d')),
    period_n    int check (period_n in (3, 5, 10)),
    review_ids  uuid[] not null check (array_length(review_ids, 1) >= 3),
    insight     jsonb not null,  -- full TradeInsight payload
    model       text not null
  );
  
  create index if not exists trade_review_insights_user_created_idx
    on public.trade_review_insights (user_id, created_at desc);
  
  alter table public.trade_review_insights enable row level security;
  
  -- Each user sees and mutates only their own rows.
  drop policy if exists "trade_review_insights_select_own" on public.trade_review_insights;
  create policy "trade_review_insights_select_own"
    on public.trade_review_insights for select
    using (auth.uid() = user_id);
  
  drop policy if exists "trade_review_insights_insert_own" on public.trade_review_insights;
  create policy "trade_review_insights_insert_own"
    on public.trade_review_insights for insert
    with check (auth.uid() = user_id);
  
  drop policy if exists "trade_review_insights_delete_own" on public.trade_review_insights;
  create policy "trade_review_insights_delete_own"
    on public.trade_review_insights for delete
    using (auth.uid() = user_id);
  
  -- Explicit Data API grants (don't rely on project defaults): no anon access,
  -- no updates — insights are immutable once written.
  revoke all on table public.trade_review_insights from anon;
  grant select, insert, delete on table public.trade_review_insights to authenticated;
  revoke update on table public.trade_review_insights from authenticated;
  
  commit;
```
