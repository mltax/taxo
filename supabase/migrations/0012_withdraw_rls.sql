-- 복지: 결재자/관리자는 전체 처리, 신청자는 본인 '대기' 건을 '회수됨'으로만 변경 가능
drop policy claims_update on public.welfare_claims;
create policy claims_update on public.welfare_claims
  for update using (
    public.current_role() in ('approver','admin')
    or (user_id = auth.uid() and status = 'pending')
  ) with check (
    public.current_role() in ('approver','admin')
    or (user_id = auth.uid() and status = 'cancelled')
  );

-- 연차: 결재자/관리자 처리, 신청자는 본인 '대기' 건을 '회수됨'으로만
drop policy leave_update on public.leave_requests;
create policy leave_update on public.leave_requests
  for update using (
    approver_id = auth.uid() or public.current_role() = 'admin'
    or (user_id = auth.uid() and status = 'pending')
  ) with check (
    approver_id = auth.uid() or public.current_role() = 'admin'
    or (user_id = auth.uid() and status = 'cancelled')
  );
