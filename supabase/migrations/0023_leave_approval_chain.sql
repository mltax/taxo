-- 연차 다단계 결재선 (최대 2단계: 팀장 → 인사관리자). 업무일지와는 별개.
alter table public.leave_requests
  add column if not exists next_approver_id uuid references public.users(id),
  add column if not exists stage smallint not null default 1,
  add column if not exists step1_approver_id uuid references public.users(id),
  add column if not exists step1_approved_at timestamptz;

create index if not exists idx_leave_requests_next_approver on public.leave_requests(next_approver_id);

-- 현재 결재자만 승인/반려. 승인 시 다음 결재자가 있으면 이관, 없으면 최종 승인. 반려 시 즉시 종결.
create or replace function public.leave_advance(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.leave_requests%rowtype;
begin
  select * into r from public.leave_requests where id = p_id;
  if not found then raise exception '신청을 찾을 수 없습니다'; end if;
  if r.status <> 'pending' then raise exception '이미 처리된 신청입니다'; end if;
  if r.approver_id is distinct from auth.uid() then raise exception '현재 결재 차례가 아닙니다'; end if;

  if not p_approve then
    update public.leave_requests
       set status = 'rejected',
           reject_reason = coalesce(nullif(btrim(p_reason), ''), '(사유 없음)')
     where id = p_id;
    return;
  end if;

  if r.next_approver_id is not null then
    -- 1단계 승인 → 2단계(인사관리자)로 이관
    update public.leave_requests
       set step1_approver_id = auth.uid(),
           step1_approved_at = now(),
           approver_id = r.next_approver_id,
           next_approver_id = null,
           stage = 2
     where id = p_id;
  else
    -- 최종 승인
    update public.leave_requests
       set status = 'approved', approved_at = now()
     where id = p_id;
  end if;
end; $$;
revoke execute on function public.leave_advance(uuid, boolean, text) from public;
revoke execute on function public.leave_advance(uuid, boolean, text) from anon;
grant execute on function public.leave_advance(uuid, boolean, text) to authenticated;
