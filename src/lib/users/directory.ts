import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * user_directory() 함수로 id→이름 맵을 만든다.
 * users 테이블 RLS(본인/관리자만 조회)와 무관하게 활성 직원 전체 이름을 얻기 위함 —
 * 일반 결재자(팀장)·직원도 신청자/작성자 이름을 정상 표시할 수 있다.
 *
 * 인자가 없어 React cache()가 한 요청 안에서 RPC를 1회만 실행하도록 보장한다
 * (여러 페이지/컴포넌트가 호출해도 중복 조회 없음).
 */
export const getNameMap = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_directory");
  return new Map(
    ((data ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name])
  );
});
