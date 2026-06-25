-- 역할/상태 enum
create type user_role as enum ('staff', 'approver', 'admin');
create type claim_status as enum ('draft', 'pending', 'approved', 'rejected', 'paid');

-- 직원/계정 (auth.users 와 1:1)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'staff',
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 복지 항목
create table public.welfare_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 복지 청구
create table public.welfare_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  item_id uuid not null references public.welfare_items(id),
  amount integer not null check (amount > 0),
  reason text not null,
  status claim_status not null default 'pending',
  approver_id uuid references public.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);

-- 청구 증빙 첨부
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.welfare_claims(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- 자료실 글/공지
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id),
  category text not null default '일반',
  title text not null,
  body text not null default '',
  is_notice boolean not null default false,
  created_at timestamptz not null default now()
);

-- 자료실 첨부
create table public.post_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- 초기 복지 항목 시드
insert into public.welfare_items (name, monthly_limit) values
  ('경조사비', null),
  ('의료비', null),
  ('자기계발비', 200000),
  ('도서구입비', 50000),
  ('식대', null),
  ('명절/생일 선물', null);
