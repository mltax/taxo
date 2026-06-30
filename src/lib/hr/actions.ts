"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canAdmin, canManageLeave } from "@/lib/roles";
import { computeLegalLeave } from "@/lib/leave/calc";

async function assertHR() {
  const user = await requireUser();
  // 인사(팀·계정) 관리는 대표(admin) 전용
  if (!canAdmin(user.role)) throw new Error("인사 관리 권한이 필요합니다.");
}

async function assertManageLeave() {
  const user = await requireUser();
  // 연차 부여 관리는 인사관리자 + 대표
  if (!canManageLeave(user.role)) throw new Error("연차 관리 권한이 필요합니다.");
}

/** 팀 생성 */
export async function createTeam(formData: FormData) {
  await assertHR();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("팀 이름을 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name });
  if (error) throw new Error("팀 생성 실패");
  revalidatePath("/admin/teams");
}

/** 팀장 지정 */
export async function setTeamLeader(teamId: string, leaderId: string | null) {
  await assertHR();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ leader_id: leaderId })
    .eq("id", teamId);
  if (error) throw new Error("팀장 지정 실패");
  revalidatePath("/admin/teams");
}

/** 직원의 팀 배정 (+직속 결재자를 팀장으로 기본 설정) */
export async function assignEmployeeTeam(userId: string, teamId: string | null) {
  await assertHR();
  const supabase = await createClient();
  let approverId: string | null = null;
  if (teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("leader_id")
      .eq("id", teamId)
      .single();
    approverId = team?.leader_id ?? null;
  }
  const { error } = await supabase
    .from("users")
    .update({ team_id: teamId, approver_id: approverId })
    .eq("id", userId);
  if (error) throw new Error("팀 배정 실패");
  revalidatePath("/admin/teams");
}

/** 직속 결재자 수동 지정 (팀장·인사관리자용) */
export async function setApprover(userId: string, approverId: string | null) {
  await assertHR();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ approver_id: approverId })
    .eq("id", userId);
  if (error) throw new Error("결재자 지정 실패");
  revalidatePath("/admin/teams");
}

/** 입사일 설정 (인사관리자/대표 — 정의자 함수로 hire_date만 변경) */
export async function setHireDate(userId: string, hireDate: string) {
  await assertManageLeave();
  const supabase = await createClient();
  const { error } = await supabase.rpc("hr_set_hire_date", {
    p_user: userId,
    p_date: hireDate || null,
  });
  if (error) throw new Error("입사일 설정 실패");
  revalidatePath("/admin/leave");
}

/** 연차 일괄 산정: 입사일 있는 전 직원에 대해 해당 연도 부여행 생성(없을 때만) */
export async function generateGrants(year: number) {
  await assertManageLeave();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, hire_date")
    .not("hire_date", "is", null);

  const { data: existing } = await supabase
    .from("leave_grants")
    .select("user_id")
    .eq("year", year);
  const has = new Set((existing ?? []).map((g) => g.user_id));

  const rows = (users ?? [])
    .filter((u) => !has.has(u.id) && u.hire_date)
    .map((u) => ({
      user_id: u.id,
      year,
      granted_days: computeLegalLeave(u.hire_date as string, year),
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("leave_grants").insert(rows);
    if (error) throw new Error("연차 일괄 산정 실패");
  }
  revalidatePath("/admin/leave");
}

/** 개별 부여일수 수정 (upsert) */
export async function setGrant(userId: string, year: number, days: number) {
  await assertManageLeave();
  if (days < 0) throw new Error("부여일수는 0 이상이어야 합니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_grants")
    .upsert({ user_id: userId, year, granted_days: days }, { onConflict: "user_id,year" });
  if (error) throw new Error("부여일수 수정 실패");
  revalidatePath("/admin/leave");
}
