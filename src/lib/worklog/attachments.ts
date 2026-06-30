import { createClient } from "@/lib/supabase/server";
import type { DownloadFile } from "@/components/file-links";

type DB = Awaited<ReturnType<typeof createClient>>;

/** 업무일지 id 목록의 첨부 + 서명 URL(원본 파일명 다운로드)을 work_log_id별로 반환 */
export async function getWorkLogFiles(
  supabase: DB,
  logIds: string[]
): Promise<Map<string, DownloadFile[]>> {
  const map = new Map<string, DownloadFile[]>();
  if (logIds.length === 0) return map;

  const { data: files } = await supabase
    .from("work_log_files")
    .select("work_log_id, file_path, file_name")
    .in("work_log_id", logIds);

  await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("worklog")
        .createSignedUrl(f.file_path, 60, { download: f.file_name });
      const list = map.get(f.work_log_id) ?? [];
      list.push({ name: f.file_name, url: data?.signedUrl ?? null });
      map.set(f.work_log_id, list);
    })
  );
  return map;
}
