-- 비공개 버킷 (자료실 첨부)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 조회/다운로드: 모든 인증 사용자
create policy "documents select authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'documents');

-- 업로드: 결재자/관리자
create policy "documents insert approver"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.current_role() in ('approver','admin'));

-- 삭제: 결재자/관리자
create policy "documents delete approver"
on storage.objects for delete to authenticated
using (bucket_id = 'documents' and public.current_role() in ('approver','admin'));
