import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  is_active: boolean;
}

/**
 * 로그인 + 활성 계정이 아니면 /login 으로 보낸다.
 * React cache()로 감싸 한 요청(레이아웃+페이지) 안에서는 1회만 실행 → 인증/프로필 조회 중복 제거.
 */
export const requireUser = cache(async (): Promise<AppUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role, department, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return profile as AppUser;
});
