create or replace function public.issue_email_verification_code(p_code_hash text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_code_hash is null or length(p_code_hash) <> 64 then
    raise exception 'invalid code hash';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invalid expiration';
  end if;

  delete from public.email_verification_codes
  where user_id = auth.uid();

  insert into public.email_verification_codes(user_id, code_hash, expires_at, attempts)
  values (auth.uid(), p_code_hash, p_expires_at, 0);
end;
$$;

revoke all on table public.email_verification_codes from anon, authenticated;
grant execute on function public.issue_email_verification_code(text, timestamptz) to authenticated;
grant execute on function public.verify_email_code(text) to authenticated;

revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "users can read own verification code" on public.email_verification_codes;
drop policy if exists "users can insert own verification code" on public.email_verification_codes;
drop policy if exists "users can update own verification code" on public.email_verification_codes;
drop policy if exists "users can delete own verification code" on public.email_verification_codes;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "users can update own profile verification" on public.profiles;
