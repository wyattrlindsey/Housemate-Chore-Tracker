-- Housemate Chore Tracker: Supabase schema
-- Tables, RLS policies, helper/RPC functions, and Realtime setup.
-- No secrets or user data.

-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_color text not null default '#14b8a6'
);

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 8)),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.house_members (
  house_id uuid references public.houses on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references auth.users on delete set null,
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  due_date date,
  completed_at timestamptz,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

-- ============ Profile auto-creation on signup ============
-- Reads display_name from auth user metadata; falls back to the email prefix.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ============ Helper ============
-- security definer avoids recursive RLS checks on house_members
create or replace function public.is_house_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from house_members where house_id = h and user_id = auth.uid());
$$;

-- ============ Row Level Security ============
alter table public.profiles      enable row level security;
alter table public.houses        enable row level security;
alter table public.house_members enable row level security;
alter table public.chores        enable row level security;

-- profiles: read yourself and anyone who shares a house with you; edit only your own
create policy "see self and housemates" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from house_members m1 join house_members m2 on m1.house_id = m2.house_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid());

-- houses: members can read; only owners can update. No direct insert (use create_house RPC).
create policy "members see house" on public.houses for select to authenticated
  using (is_house_member(id));
create policy "owner renames house" on public.houses for update to authenticated
  using (exists (select 1 from house_members
                 where house_id = houses.id and user_id = auth.uid() and role = 'owner'));

-- house_members: members can read their house's roster; users can remove themselves.
-- No direct insert (use create_house / join_house RPCs).
create policy "members see members" on public.house_members for select to authenticated
  using (is_house_member(house_id));
create policy "leave a house" on public.house_members for delete to authenticated
  using (user_id = auth.uid());

-- chores: full CRUD for house members; assignee must be a member of the same house
create policy "members read chores" on public.chores for select to authenticated
  using (is_house_member(house_id));
create policy "members add chores" on public.chores for insert to authenticated
  with check (is_house_member(house_id) and (assignee_id is null or exists (
    select 1 from house_members where house_id = chores.house_id and user_id = chores.assignee_id)));
create policy "members edit chores" on public.chores for update to authenticated
  using (is_house_member(house_id))
  with check (is_house_member(house_id) and (assignee_id is null or exists (
    select 1 from house_members where house_id = chores.house_id and user_id = chores.assignee_id)));
create policy "members delete chores" on public.chores for delete to authenticated
  using (is_house_member(house_id));

-- ============ RPCs ============
-- supabase.rpc('create_house', { house_name }) -> houses row; caller becomes owner
create or replace function public.create_house(house_name text)
returns public.houses language plpgsql security definer set search_path = public as $$
declare h houses;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into houses (name, created_by) values (house_name, auth.uid()) returning * into h;
  insert into house_members (house_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end; $$;

-- supabase.rpc('join_house', { code }) -> houses row; raises 'Invalid invite code' if no match.
-- Case-insensitive, trims whitespace, idempotent if already a member.
create or replace function public.join_house(code text)
returns public.houses language plpgsql security definer set search_path = public as $$
declare h houses;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into h from houses where invite_code = upper(trim(code));
  if not found then raise exception 'Invalid invite code'; end if;
  insert into house_members (house_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end; $$;

revoke execute on function public.create_house(text), public.join_house(text) from public, anon;
grant  execute on function public.create_house(text), public.join_house(text) to authenticated;

-- ============ Realtime ============
alter publication supabase_realtime add table public.chores;
