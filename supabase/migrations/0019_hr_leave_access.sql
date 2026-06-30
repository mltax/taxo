-- 인사관리자(hr_manager)에게 연차 부여 관리 권한 부여 (대표/admin 유지)

-- 연차 부여 쓰기: 인사관리자 + 대표
drop policy grants_admin_write on public.leave_grants;
create policy grants_hr_write on public.leave_grants
  for all using (public.current_role() in ('hr_manager','admin'))
  with check (public.current_role() in ('hr_manager','admin'));

-- 연차 부여 조회: 본인 또는 인사관리자/대표
drop policy grants_select on public.leave_grants;
create policy grants_select on public.leave_grants
  for select using (user_id = auth.uid() or public.current_role() in ('hr_manager','admin'));

-- 직원 조회: 인사관리자도 전 직원 조회 가능(연차 산정/입사일 관리용)
create policy users_hr_select on public.users
  for select using (public.current_role() in ('hr_manager','admin'));

-- 입사일 변경: 인사관리자/대표만, hire_date 컬럼만 (정의자 함수 — users 광범위 수정권 부여 없이)
create or replace function public.hr_set_hire_date(p_user uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() not in ('hr_manager','admin') then
    raise exception '권한이 없습니다';
  end if;
  update public.users set hire_date = p_date where id = p_user;
end; $$;
revoke execute on function public.hr_set_hire_date(uuid, date) from public;
revoke execute on function public.hr_set_hire_date(uuid, date) from anon;
grant execute on function public.hr_set_hire_date(uuid, date) to authenticated;
