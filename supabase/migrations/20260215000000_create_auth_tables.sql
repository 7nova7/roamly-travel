-- =============================================================
-- Roamly: profiles & trips tables + RLS + auto-profile trigger
-- =============================================================

-- 1. profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins can read all profiles"
  on profiles for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Users can update their own profile (but cannot change role)
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (role = (select role from profiles where id = auth.uid()));

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. trips table
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  trip_config jsonb not null,
  itinerary jsonb not null,
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips enable row level security;

create index idx_trips_user_id on trips(user_id);
create index idx_trips_updated_at on trips(updated_at desc);

-- Users can CRUD their own trips
create policy "Users can read own trips"
  on trips for select using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on trips for insert with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trips for update using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trips for delete using (auth.uid() = user_id);

-- Admins can read all trips
create policy "Admins can read all trips"
  on trips for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );
