-- 외래키 커버링 인덱스 (조인·필터·정렬 성능)
create index if not exists idx_attachments_claim_id on public.attachments(claim_id);
create index if not exists idx_leave_requests_user_id on public.leave_requests(user_id);
create index if not exists idx_leave_requests_approver_id on public.leave_requests(approver_id);
create index if not exists idx_point_ledger_user_id on public.point_ledger(user_id);
create index if not exists idx_post_files_post_id on public.post_files(post_id);
create index if not exists idx_post_ratings_voter_id on public.post_ratings(voter_id);
create index if not exists idx_posts_author_id on public.posts(author_id);
create index if not exists idx_teams_leader_id on public.teams(leader_id);
create index if not exists idx_users_approver_id on public.users(approver_id);
create index if not exists idx_users_team_id on public.users(team_id);
create index if not exists idx_welfare_claims_user_id on public.welfare_claims(user_id);
create index if not exists idx_welfare_claims_approver_id on public.welfare_claims(approver_id);
create index if not exists idx_welfare_claims_item_id on public.welfare_claims(item_id);
create index if not exists idx_work_log_files_work_log_id on public.work_log_files(work_log_id);
create index if not exists idx_work_logs_user_id on public.work_logs(user_id);
create index if not exists idx_work_logs_approver_id on public.work_logs(approver_id);

-- 자주 쓰는 조건 인덱스 (상태별 승인함 조회 등)
create index if not exists idx_leave_requests_approver_status on public.leave_requests(approver_id, status);
create index if not exists idx_work_logs_approver_status on public.work_logs(approver_id, status);
create index if not exists idx_welfare_claims_status on public.welfare_claims(status);
create index if not exists idx_posts_board_type on public.posts(board_type);
