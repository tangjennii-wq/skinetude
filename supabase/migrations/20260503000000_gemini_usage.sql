-- Per-device daily usage counter for the Gemini proxy.
-- One row per (device_id, day, mode). Caps are enforced by the
-- check_and_bump_gemini() function called from the Edge Function.

create table if not exists public.gemini_usage (
  device_id text not null,
  day       date not null default current_date,
  mode      text not null check (mode in ('image', 'text')),
  count     integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (device_id, day, mode)
);

create index if not exists gemini_usage_day_idx on public.gemini_usage (day);

-- Lock the table down. Only the service role (used by the Edge Function) can
-- read/write. The anon key cannot touch this from the browser.
alter table public.gemini_usage enable row level security;
revoke all on public.gemini_usage from anon, authenticated;

-- Atomic check-and-bump. Returns whether the call is allowed plus the
-- post-bump count for telemetry. Uses an UPSERT, then rolls back the bump
-- if it would exceed the cap (so failed calls don't burn the quota).
create or replace function public.check_and_bump_gemini(
  p_device text,
  p_mode   text,
  p_limit  int
)
returns table(allowed boolean, current_count int, daily_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_mode not in ('image', 'text') then
    raise exception 'invalid mode: %', p_mode;
  end if;
  if p_limit <= 0 then
    raise exception 'invalid limit: %', p_limit;
  end if;

  insert into public.gemini_usage (device_id, day, mode, count, updated_at)
  values (p_device, current_date, p_mode, 1, now())
  on conflict (device_id, day, mode)
  do update set count = public.gemini_usage.count + 1,
                updated_at = now()
  returning count into v_count;

  if v_count > p_limit then
    -- Roll back the bump so the cap is honored exactly.
    update public.gemini_usage
       set count = count - 1,
           updated_at = now()
     where device_id = p_device
       and day = current_date
       and mode = p_mode;
    return query select false, p_limit, p_limit;
    return;
  end if;

  return query select true, v_count, p_limit;
end;
$$;

-- Only the service role should be able to call the bump. The function is
-- security definer so it can write to the locked-down table.
revoke all on function public.check_and_bump_gemini(text, text, int) from public, anon, authenticated;
grant execute on function public.check_and_bump_gemini(text, text, int) to service_role;

-- Optional housekeeping: a job/cron can periodically delete rows older than
-- 30 days. Not enforced here.
