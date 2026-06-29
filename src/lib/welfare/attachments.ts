import { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

export interface ClaimFile {
  name: string;
  url: string | null;
}

/** 청구 id 목록에 대한 증빙 첨부 + 서명 URL(60초)을 claim_id별로 반환 */
export async function getClaimFiles(
  supabase: DB,
  claimIds: string[]
): Promise<Map<string, ClaimFile[]>> {
  const map = new Map<string, ClaimFile[]>();
  if (claimIds.length === 0) return map;

  const { data: atts } = await supabase
    .from("attachments")
    .select("claim_id, file_path, file_name")
    .in("claim_id", claimIds);

  await Promise.all(
    (atts ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("receipts")
        .createSignedUrl(a.file_path, 60);
      const list = map.get(a.claim_id) ?? [];
      list.push({ name: a.file_name, url: data?.signedUrl ?? null });
      map.set(a.claim_id, list);
    })
  );
  return map;
}
