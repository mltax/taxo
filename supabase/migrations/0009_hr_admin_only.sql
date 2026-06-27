-- 인사(HR) 데이터 관리를 대표(admin) 전용으로 제한
drop policy teams_hr_write on public.teams;
create policy teams_admin_write on public.teams
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy grants_hr_write on public.leave_grants;
create policy grants_admin_write on public.leave_grants
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
drop policy grants_select on public.leave_grants;
create policy grants_select on public.leave_grants
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy leave_update on public.leave_requests;
create policy leave_update on public.leave_requests
  for update using (approver_id = auth.uid() or public.current_role() = 'admin');
drop policy leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select using (user_id = auth.uid() or approver_id = auth.uid() or public.current_role() = 'admin');

drop policy users_hr_select on public.users;
drop policy users_hr_update on public.users;

drop function if exists public.is_hr();
