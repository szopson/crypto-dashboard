-- Trade-review + insights quotas: extends ai_setup_usage with two new daily
-- counters and teaches consume_ai_setup_quota() two new kinds:
--   'trade_review' → 5/day  (Opus vision review on /api/trade-review)
--   'insight'      → 2/day  (meta-review on /api/trade-review/insights)
--
-- No migration runner is wired up for this project, so apply by hand:
-- Supabase dashboard → SQL Editor → paste → Run. Idempotent (safe to re-run).
--
-- MUST be applied BEFORE the code that calls the new kinds reaches main:
-- consumeQuota() fails closed, so code-first would 503 every trade review.
--
-- Backward compatibility: the function keeps its name, signature and return
-- shape ({allowed, remaining}), so already-deployed callers using
-- 'generation'/'chat' are unaffected mid-rollout.
--
-- Hardening vs 0002 (review feedback): search_path is pinned empty and every
-- object reference is schema-qualified, so a SECURITY DEFINER lookup can never
-- be hijacked by objects planted in a writable schema.

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

  -- Conditional increment is a single statement per kind, so concurrent
  -- requests cannot overshoot the limit (no check-then-increment race).
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
