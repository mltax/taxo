create type work_log_status as enum ('pending', 'approved', 'rejected');

create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null default current_date,
  title text not null default '',
  content text not null,
  status work_log_status not null default 'pending',
  approver_id uuid not null references public.users(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
alter table public.work_logs enable row level security;

create policy worklog_select on public.work_logs
  for select using (user_id = auth.uid() or approver_id = auth.uid());
create policy worklog_insert on public.work_logs
  for insert with check (user_id = auth.uid());
create policy worklog_update on public.work_logs
  for update using (approver_id = auth.uid()) with check (approver_id = auth.uid());

-- 직원 디렉터리 (id, 이름, 역할만 — 결재자 선택·이름 표시용)
create or replace function public.user_directory()
returns table(id uuid, name text, role user_role)
language sql stable security definer set search_path = public as $$
  select id, name, role from public.users where is_active;
$$;
revoke execute on function public.user_directory() from public;
revoke execute on function public.user_directory() from anon;
grant execute on function public.user_directory() to authenticated;
