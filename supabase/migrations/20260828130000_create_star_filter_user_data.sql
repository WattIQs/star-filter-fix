create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_leads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id text not null,
  lead_data jsonb not null,
  saved_at timestamptz not null default now(),
  unique (user_id, lead_id)
);

create index saved_leads_user_id_idx on public.saved_leads(user_id);
create index saved_leads_user_saved_at_idx on public.saved_leads(user_id, saved_at desc);

alter table public.profiles enable row level security;
alter table public.saved_leads enable row level security;

create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users can read own saved leads" on public.saved_leads for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own saved leads" on public.saved_leads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own saved leads" on public.saved_leads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own saved leads" on public.saved_leads for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_leads to authenticated;