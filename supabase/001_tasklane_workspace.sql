begin;

create table if not exists public.tasklane_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null check (
    jsonb_typeof(state) = 'object' and octet_length(state::text) <= 1048576
  ),
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.tasklane_workspaces enable row level security;
revoke all on public.tasklane_workspaces from public, anon, authenticated;
grant select on public.tasklane_workspaces to authenticated;

drop policy if exists "Dymon reads TaskLane" on public.tasklane_workspaces;
create policy "Dymon reads TaskLane" on public.tasklane_workspaces
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.tiershelf_is_owner()));

create or replace function public.tasklane_save_workspace(next_state jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved_revision bigint;
begin
  if owner_id is null or not public.tiershelf_is_owner() then
    raise exception 'TaskLane owner access required' using errcode = '42501';
  end if;
  if expected_revision = 0 then
    insert into public.tasklane_workspaces(user_id, state, revision)
      values (owner_id, next_state, 1)
      on conflict (user_id) do nothing
      returning revision into saved_revision;
  else
    update public.tasklane_workspaces
      set state = next_state, revision = revision + 1, updated_at = pg_catalog.now()
      where user_id = owner_id and revision = expected_revision
      returning revision into saved_revision;
  end if;
  if saved_revision is null then
    raise exception 'TaskLane changed on another device' using errcode = '40001';
  end if;
  return saved_revision;
end;
$$;

revoke all on function public.tasklane_save_workspace(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.tasklane_save_workspace(jsonb, bigint) to authenticated;
notify pgrst, 'reload schema';

commit;
