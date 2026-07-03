-- 홈 화면 전 직원 연차 캘린더용 RPC.
-- leave_requests SELECT RLS는 본인·결재자·HR로 제한되므로, 일반 직원이
-- 전 직원의 승인 연차를 캘린더로 볼 수 있도록 security definer 함수로
-- 최소 정보만 노출한다. (사유 등 개인정보 제외 — 이름·기간·종류·일수만)
create or replace function public.leave_calendar(p_from date, p_to date)
returns table(
  user_id uuid,
  name text,
  start_date date,
  end_date date,
  leave_type leave_type,
  days numeric
)
language sql stable security definer set search_path = public as $$
  select lr.user_id, u.name, lr.start_date, lr.end_date, lr.leave_type, lr.days
  from public.leave_requests lr
  join public.users u on u.id = lr.user_id
  where lr.status = 'approved'
    and lr.start_date <= p_to
    and lr.end_date >= p_from
  order by lr.start_date, u.name;
$$;
revoke execute on function public.leave_calendar(date, date) from public;
revoke execute on function public.leave_calendar(date, date) from anon;
grant execute on function public.leave_calendar(date, date) to authenticated;
