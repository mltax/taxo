-- 포상 포인트 부여 시각 (이번 달 획득 집계용)
alter table public.posts add column reward_points_at timestamptz;
