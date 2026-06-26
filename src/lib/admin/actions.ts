"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canAdmin, type Role } from "@/lib/roles";

async function assertAdmin() {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("관리자 권한이 필요합니다.");
  return user;
}

/** 직원 계정 발급: auth 사용자 + 프로필 생성 */
export async function createEmployee(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;
  const department = String(formData.get("department") ?? "").trim() || null;

  if (!email) throw new Error("이메일을 입력하세요.");
  if (password.length < 6) throw new Error("임시 비밀번호는 6자 이상이어야 합니다.");
  if (!name) throw new Error("이름을 입력하세요.");

  const admin = createAdminClient();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`계정 생성 실패: ${cErr?.message ?? "알 수 없음"}`);

  const { error: pErr } = await admin
    .from("users")
    .insert({ id: created.user.id, email, name, role, department });
  if (pErr) {
    // 프로필 생성 실패 시 방금 만든 auth 사용자 롤백
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error("프로필 생성 실패. 다시 시도하세요.");
  }
  revalidatePath("/admin/employees");
}

/** 직원 활성/비활성 토글 */
export async function setEmployeeActive(userId: string, isActive: boolean) {
  await assertAdmin();
  const supabase = await createClient(); // 관리자 세션 + RLS(users_admin_all)
  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);
  if (error) throw new Error("상태 변경 실패");
  revalidatePath("/admin/employees");
}

/** 직원 역할 변경 (결재선 = approver 부여) */
export async function setEmployeeRole(userId: string, role: Role) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw new Error("역할 변경 실패");
  revalidatePath("/admin/employees");
}

/** 복지 항목 추가 */
export async function addWelfareItem(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const limitRaw = String(formData.get("monthly_limit") ?? "").trim();
  const monthly_limit = limitRaw ? Number(limitRaw) : null;
  if (!name) throw new Error("항목명을 입력하세요.");
  if (monthly_limit !== null && (!Number.isInteger(monthly_limit) || monthly_limit < 0))
    throw new Error("한도를 올바르게 입력하세요.");

  const supabase = await createClient();
  const { error } = await supabase.from("welfare_items").insert({ name, monthly_limit });
  if (error) throw new Error("항목 추가 실패");
  revalidatePath("/admin/items");
}

/** 복지 항목 활성/비활성 토글 */
export async function setWelfareItemActive(itemId: string, isActive: boolean) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("welfare_items").update({ is_active: isActive }).eq("id", itemId);
  if (error) throw new Error("상태 변경 실패");
  revalidatePath("/admin/items");
}
