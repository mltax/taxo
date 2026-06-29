-- posts 권한 세분화: 작성=결재자/관리자, 수정/삭제는 게시판·작성자별
drop policy posts_write on public.posts;

create policy posts_insert on public.posts
  for insert with check (public.current_role() in ('approver','admin'));

create policy posts_update on public.posts
  for update using (
    (board_type = 'work' and public.current_role() = 'admin')
    or (board_type = 'free' and author_id = auth.uid())
  ) with check (
    (board_type = 'work' and public.current_role() = 'admin')
    or (board_type = 'free' and author_id = auth.uid())
  );

create policy posts_delete on public.posts
  for delete using (
    (board_type = 'work' and public.current_role() = 'admin')
    or (board_type = 'free' and (author_id = auth.uid() or public.current_role() = 'admin'))
  );

-- 포인트 원장: 삭제된 글의 포상 포인트를 적립해 누적 유지
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  points integer not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.point_ledger enable row level security;
create policy ledger_select on public.point_ledger
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy ledger_admin_insert on public.point_ledger
  for insert with check (public.current_role() = 'admin');
