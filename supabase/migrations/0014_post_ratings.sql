-- 업무공유 게시글 포상 포인트 (관리자 부여, 1000~20000)
alter table public.posts add column reward_points integer;

-- 익명 평점 (1~5, 인별 1회)
create table public.post_ratings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  voter_id uuid not null references public.users(id),
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (post_id, voter_id)
);
alter table public.post_ratings enable row level security;

-- 익명: 본인 투표만 조회/생성/수정 (타인 투표 조회 불가)
create policy ratings_select_own on public.post_ratings
  for select using (voter_id = auth.uid());
create policy ratings_insert_own on public.post_ratings
  for insert with check (voter_id = auth.uid() and score between 1 and 5);
create policy ratings_update_own on public.post_ratings
  for update using (voter_id = auth.uid()) with check (voter_id = auth.uid() and score between 1 and 5);

-- 집계(평균/건수)만 반환 → 익명 유지
create or replace function public.post_rating_summary(p_post_id uuid)
returns table(avg_score numeric, vote_count integer)
language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(score)::numeric, 1), 0), count(*)::int
  from public.post_ratings where post_id = p_post_id;
$$;
revoke execute on function public.post_rating_summary(uuid) from public, anon;
grant execute on function public.post_rating_summary(uuid) to authenticated;

create or replace function public.work_post_rating_summaries()
returns table(post_id uuid, avg_score numeric, vote_count integer)
language sql stable security definer set search_path = public as $$
  select pr.post_id, round(avg(pr.score)::numeric, 1), count(*)::int
  from public.post_ratings pr
  join public.posts p on p.id = pr.post_id and p.board_type = 'work'
  group by pr.post_id;
$$;
revoke execute on function public.work_post_rating_summaries() from public, anon;
grant execute on function public.work_post_rating_summaries() to authenticated;
