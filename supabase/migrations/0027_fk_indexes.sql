-- FK 커버링 인덱스 추가 (성능 어드바이저 unindexed_foreign_keys 해소).
-- 조인·삭제 시 상위 테이블 변경이 자식 FK를 스캔할 때 성능을 개선한다.
create index if not exists idx_calendar_events_created_by on public.calendar_events(created_by);
create index if not exists idx_leave_requests_step1_approver on public.leave_requests(step1_approver_id);
create index if not exists idx_manual_leave_events_user on public.manual_leave_events(user_id);
