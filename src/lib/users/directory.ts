import { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * user_directory() 함수로 id→이름 맵을 만든다.
 * users 테이블 RLS(본인/관리자만 조회)와 무관하게 활성 직원 전체 이름을 얻기 위함 —
 * 일반 결재자(팀장)·직원도 신청자/작성자 이름을 정상 표시할 수 있다.
 */
export async function getNameMap(supabase: DB): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("user_directory");
  return new Map(
    ((data ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name])
  );
}
