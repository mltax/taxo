-- 인사관리자도 전 직원 연차 신청 내역 조회 가능 (사용·잔여 집계용)
drop policy leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select using (
    user_id = auth.uid() or approver_id = auth.uid()
    or public.current_role() in ('hr_manager','admin')
  );
