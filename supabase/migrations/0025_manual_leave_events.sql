-- 캘린더 표시 전용 연차(잔여 연차에서 차감하지 않는 예외 연차).
-- 시스템 도입 전 확정분·공가·특별휴가 등, 결재 없이 캘린더에만 반영하고
-- 잔여 연차 계산에는 포함하지 않아야 하는 항목을 별도 테이블에 보관한다.
-- (leave_requests 에 넣지 않으므로 잔여 연차 집계에 자동으로 미포함)
create table if not exists public.manual_leave_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  leave_type leave_type not null default 'full',
  days numeric(6,3) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- RLS 활성화 + 정책 없음 → 직접 API 접근 차단. 오직 security definer RPC 로만 노출.
alter table public.manual_leave_events enable row level security;

-- 캘린더 RPC: 승인된 연차(leave_requests) + 표시 전용 이벤트(manual_leave_events) 합산.
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
  union all
  select m.user_id, coalesce(u2.name, m.name), m.start_date, m.end_date, m.leave_type, m.days
  from public.manual_leave_events m
  left join public.users u2 on u2.id = m.user_id
  where m.start_date <= p_to
    and m.end_date >= p_from
  order by start_date, name;
$$;
revoke execute on function public.leave_calendar(date, date) from public;
revoke execute on function public.leave_calendar(date, date) from anon;
grant execute on function public.leave_calendar(date, date) to authenticated;
