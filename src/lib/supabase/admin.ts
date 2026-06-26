import { createClient } from "@supabase/supabase-js";

/** service_role 키를 쓰는 서버 전용 클라이언트. RLS 우회 — 서버 액션 내부에서만 사용. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
