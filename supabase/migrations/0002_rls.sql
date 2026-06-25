-- 현재 사용자 역할 헬퍼
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

alter table public.users enable row level security;
alter table public.welfare_items enable row level security;
alter table public.welfare_claims enable row level security;
alter table public.attachments enable row level security;
alter table public.posts enable row level security;
alter table public.post_files enable row level security;

-- users: 본인 조회, 관리자 전체 조회/수정
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.current_role() = 'admin');
create policy users_admin_all on public.users
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- welfare_items: 활성 항목은 모두 조회, 변경은 관리자만
create policy items_select on public.welfare_items
  for select using (is_active or public.current_role() = 'admin');
create policy items_admin_write on public.welfare_items
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- welfare_claims: 본인 것 또는 결재자/관리자 조회
create policy claims_select on public.welfare_claims
  for select using (
    user_id = auth.uid() or public.current_role() in ('approver','admin')
  );
-- 본인만 신청 생성
create policy claims_insert_self on public.welfare_claims
  for insert with check (user_id = auth.uid());
-- 결재자/관리자는 결재 처리(update), 본인은 자기 draft 수정 가능
create policy claims_update on public.welfare_claims
  for update using (
    public.current_role() in ('approver','admin')
    or (user_id = auth.uid())
  );

-- attachments: 연결된 claim 접근 권한과 동일
create policy attachments_select on public.attachments
  for select using (
    exists (
      select 1 from public.welfare_claims c
      where c.id = claim_id
        and (c.user_id = auth.uid() or public.current_role() in ('approver','admin'))
    )
  );
create policy attachments_insert on public.attachments
  for insert with check (
    exists (
      select 1 from public.welfare_claims c
      where c.id = claim_id and c.user_id = auth.uid()
    )
  );

-- posts: 모든 인증 사용자 조회, 결재자/관리자만 작성
create policy posts_select on public.posts
  for select using (auth.uid() is not null);
create policy posts_write on public.posts
  for all using (public.current_role() in ('approver','admin'))
  with check (public.current_role() in ('approver','admin'));

-- post_files: posts 와 동일 규칙
create policy post_files_select on public.post_files
  for select using (auth.uid() is not null);
create policy post_files_write on public.post_files
  for all using (public.current_role() in ('approver','admin'))
  with check (public.current_role() in ('approver','admin'));
