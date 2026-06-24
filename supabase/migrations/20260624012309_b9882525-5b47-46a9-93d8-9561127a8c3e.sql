
create table if not exists public.rate_limit_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_user_bucket_time_idx
  on public.rate_limit_events (user_id, bucket, created_at desc);

grant select, insert on public.rate_limit_events to authenticated;
grant all on public.rate_limit_events to service_role;
grant usage, select on sequence public.rate_limit_events_id_seq to authenticated;

alter table public.rate_limit_events enable row level security;

create policy "own rate events read"
  on public.rate_limit_events for select
  to authenticated
  using (user_id = auth.uid());

create policy "own rate events insert"
  on public.rate_limit_events for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.check_and_record_rate_limit(
  _bucket text,
  _max int,
  _window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _count int;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into _count
  from public.rate_limit_events
  where user_id = _uid
    and bucket = _bucket
    and created_at > now() - make_interval(secs => _window_seconds);

  if _count >= _max then
    return false;
  end if;

  insert into public.rate_limit_events(user_id, bucket) values (_uid, _bucket);

  delete from public.rate_limit_events
  where user_id = _uid
    and bucket = _bucket
    and created_at < now() - make_interval(secs => _window_seconds * 4);

  return true;
end;
$$;

grant execute on function public.check_and_record_rate_limit(text, int, int) to authenticated;
