alter table public.profiles
  add column if not exists email_verified boolean not null default false;

create table if not exists public.email_verification_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);

alter table public.email_verification_codes enable row level security;
revoke all on public.email_verification_codes from anon, authenticated;
grant insert, update on public.email_verification_codes to authenticated;

drop function if exists public.verify_email_code(text);
create or replace function public.verify_email_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_expires timestamptz;
  v_attempts integer;
begin
  if v_user_id is null or p_code is null or p_code !~ '^\d{6}$' then
    return false;
  end if;

  select code_hash, expires_at, attempts
    into v_hash, v_expires, v_attempts
  from public.email_verification_codes
  where user_id = v_user_id
  for update;

  if not found or v_attempts >= 5 or v_expires <= now() then
    return false;
  end if;

  if encode(digest(trim(p_code), 'sha256'), 'hex') <> v_hash then
    update public.email_verification_codes
      set attempts = attempts + 1
    where user_id = v_user_id;
    return false;
  end if;

  update public.profiles
    set email_verified = true, updated_at = now()
  where id = v_user_id;

  delete from public.email_verification_codes where user_id = v_user_id;
  return true;
end;
$$;

revoke all on function public.verify_email_code(text) from public;
grant execute on function public.verify_email_code(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, display_name, email_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin;
