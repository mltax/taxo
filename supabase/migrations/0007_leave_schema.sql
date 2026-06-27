-- 팀
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- users 확장
alter table public.users
  add column hire_date date,
  add column team_id uuid references public.teams(id),
  add column approver_id uuid references public.users(id);

-- 연차 상태
create type leave_status as enum ('pending', 'approved', 'rejected');

-- 연도별 부여 연차
create table public.leave_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  year integer not null,
  granted_days numeric(4,1) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

-- 연차 신청
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null check (days > 0),
  half_day boolean not null default false,
  reason text not null default '',
  status leave_status not null default 'pending',
  approver_id uuid references public.users(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
