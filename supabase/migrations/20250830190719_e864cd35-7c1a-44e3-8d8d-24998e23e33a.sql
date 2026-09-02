
-- 1) Create per-user section permissions table
create table if not exists public.company_user_section_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_email text not null,
  access_sections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_email)
);

-- 2) Maintain updated_at on updates
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_timestamp_company_user_section_permissions on public.company_user_section_permissions;

create trigger set_timestamp_company_user_section_permissions
before update on public.company_user_section_permissions
for each row
execute function public.set_current_timestamp_updated_at();

-- 3) Enable RLS
alter table public.company_user_section_permissions enable row level security;

-- 4) RLS policies:
-- Allow all company members to view their company's permissions
drop policy if exists "Team members can view section permissions" on public.company_user_section_permissions;
create policy "Team members can view section permissions"
  on public.company_user_section_permissions
  for select
  using (company_id = get_user_company_id());

-- Only admins can insert (create/update) permissions for their company
drop policy if exists "Only admins can insert section permissions" on public.company_user_section_permissions;
create policy "Only admins can insert section permissions"
  on public.company_user_section_permissions
  for insert
  with check ((company_id = get_user_company_id()) and is_user_admin());

-- Only admins can update permissions for their company
drop policy if exists "Only admins can update section permissions" on public.company_user_section_permissions;
create policy "Only admins can update section permissions"
  on public.company_user_section_permissions
  for update
  using ((company_id = get_user_company_id()) and is_user_admin());

-- Only admins can delete permissions for their company
drop policy if exists "Only admins can delete section permissions" on public.company_user_section_permissions;
create policy "Only admins can delete section permissions"
  on public.company_user_section_permissions
  for delete
  using ((company_id = get_user_company_id()) and is_user_admin());
