-- AI Trade Setup quotas: per-user daily counters for /api/ai-setup/*.
--
-- No migration runner is wired up for this project yet, so apply this by hand:
-- Supabase dashboard → SQL Editor → paste → Run. Idempotent (safe to re-run).
--
-- Access model: clients never write this table. Route handlers call
-- consume_ai_setup_quota() (security definer) on a request-scoped client
-- authenticated with the user's JWT, BEFORE any billed Anthropic call, and
-- fail closed if the RPC errors. RLS exposes read-only own-row access so the
-- UI can show "X left today" without a bespoke endpoint.

create table if not exists public.ai_setup_usage (
  user_id       uuid not null references auth.users (id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  generations   int  not null default 0,
  chat_messages int  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_setup_usage enable row level security;

drop policy if exists "ai_setup_usage_select_own" on public.ai_setup_usage;
create policy "ai_setup_usage_select_own"
  on public.ai_setup_usage for select
  using (auth.uid() = user_id);
-- No insert/update/delete policies: all writes go through the function below.

-- Atomically consume one unit of quota for the calling user. The conditional
-- UPDATE ... WHERE count < limit is a single statement, so concurrent requests
-- cannot overshoot the limit (no check-then-increment race).
create or replace function public.consume_ai_setup_quota(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    when 'generation' then 10
    when 'chat'       then 30
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
  else
    update public.ai_setup_usage
       set chat_messages = chat_messages + 1, updated_at = now()
     where user_id = v_user and day = v_day and chat_messages < v_limit
     returning chat_messages into v_used;
  end if;

  if v_used is null then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;
  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_used);
end;
$$;

revoke all on function public.consume_ai_setup_quota(text) from public, anon;
grant execute on function public.consume_ai_setup_quota(text) to authenticated;
