-- 캘린더 공유 일정(사내 회의·외부교육·세미나 등).
-- 관리자(인사관리자·대표)만 등록/수정/삭제, 전 직원 조회. 캘린더에 기간 표시.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 10),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

-- 조회: 인증된 전 직원
create policy calendar_events_select on public.calendar_events
  for select using (auth.uid() is not null);

-- 등록/수정/삭제: 관리자(인사관리자·대표)
create policy calendar_events_write on public.calendar_events
  for all
  using (public.current_role() in ('hr_manager', 'admin'))
  with check (public.current_role() in ('hr_manager', 'admin'));

create index if not exists idx_calendar_events_range on public.calendar_events(start_date, end_date);
