-- Create table for email confirmation tokens
create table if not exists public.email_confirmations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  purpose text not null default 'register',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null
);

-- Ensure fast lookups
create unique index if not exists email_confirmations_token_hash_idx on public.email_confirmations(token_hash);
create index if not exists email_confirmations_email_idx on public.email_confirmations(email);
create index if not exists email_confirmations_expires_idx on public.email_confirmations(expires_at);

-- Enable RLS and permissive policy for service/edge usage
alter table public.email_confirmations enable row level security;
drop policy if exists "Allow email confirmation operations" on public.email_confirmations;
create policy "Allow email confirmation operations" on public.email_confirmations for all using (true) with check (true);