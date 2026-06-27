-- HR 권한 헬퍼
create or replace function public.is_hr()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('hr_manager','admin');
$$;
revoke execute on function public.is_hr() from public;
revoke execute on function public.is_hr() from anon;
grant execute on function public.is_hr() to authenticated;

alter table public.teams enable row level security;
alter table public.leave_grants enable row level security;
alter table public.leave_requests enable row level security;

-- teams: 인증 조회, HR 작성
create policy teams_select on public.teams
  for select using (auth.uid() is not null);
create policy teams_hr_write on public.teams
  for all using (public.is_hr()) with check (public.is_hr());

-- leave_grants: 본인 또는 HR 조회, HR 작성
create policy grants_select on public.leave_grants
  for select using (user_id = auth.uid() or public.is_hr());
create policy grants_hr_write on public.leave_grants
  for all using (public.is_hr()) with check (public.is_hr());

-- leave_requests
create policy leave_select on public.leave_requests
  for select using (
    user_id = auth.uid() or approver_id = auth.uid() or public.is_hr()
  );
create policy leave_insert_self on public.leave_requests
  for insert with check (user_id = auth.uid());
create policy leave_update on public.leave_requests
  for update using (approver_id = auth.uid() or public.is_hr());

-- users: HR 도 전체 조회/수정 가능 (팀·결재자·입사일 관리)
create policy users_hr_select on public.users
  for select using (public.is_hr());
create policy users_hr_update on public.users
  for update using (public.is_hr()) with check (public.is_hr());
