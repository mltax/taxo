-- 비공개 버킷 생성
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 업로드: 인증 사용자가 본인(owner) 파일로 업로드
create policy "receipts insert own"
on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and owner = auth.uid());

-- 조회: 본인 파일 또는 결재자/관리자
create policy "receipts select own or approver"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (owner = auth.uid() or public.current_role() in ('approver','admin'))
);

-- 삭제: 본인 파일만 (반려 후 정리 등)
create policy "receipts delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and owner = auth.uid());
