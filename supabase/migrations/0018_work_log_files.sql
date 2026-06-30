insert into storage.buckets (id, name, public)
values ('worklog', 'worklog', false) on conflict (id) do nothing;

create policy "worklog insert own" on storage.objects
  for insert to authenticated with check (bucket_id = 'worklog' and owner = auth.uid());
create policy "worklog select authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'worklog');
create policy "worklog delete own" on storage.objects
  for delete to authenticated using (bucket_id = 'worklog' and owner = auth.uid());

create table public.work_log_files (
  id uuid primary key default gen_random_uuid(),
  work_log_id uuid not null references public.work_logs(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);
alter table public.work_log_files enable row level security;

create policy worklog_files_select on public.work_log_files
  for select using (
    exists (select 1 from public.work_logs w
      where w.id = work_log_id and (w.user_id = auth.uid() or w.approver_id = auth.uid()))
  );
create policy worklog_files_insert on public.work_log_files
  for insert with check (
    exists (select 1 from public.work_logs w
      where w.id = work_log_id and w.user_id = auth.uid())
  );
