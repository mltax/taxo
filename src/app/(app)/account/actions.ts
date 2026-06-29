"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** 로그인한 본인의 비밀번호 변경 */
export async function changePassword(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
  if (password !== confirm) return { error: "비밀번호가 일치하지 않습니다." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `변경 실패: ${error.message}` };
  return { ok: true };
}
