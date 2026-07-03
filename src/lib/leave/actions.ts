"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove, type Role } from "@/lib/roles";
import { countLeaveDays } from "@/lib/leave/calc";
import { getLeaveCalendarEvents } from "@/lib/leave/calendar";
import { LEAVE_TYPES, isSingleDayType, type LeaveType } from "@/lib/leave/types";

/** 홈 캘린더: 특정 연·월의 전 직원 승인 연차 조회 (인증 사용자 한정) */
export async function fetchLeaveCalendar(year: number, month: number) {
  await requireUser();
  return getLeaveCalendarEvents(year, month);
}

/**
 * 연차 결재선 구성 (업무일지와 별개).
 * - 팀원: 팀장 → 인사관리자 (팀장==인사관리자면 인사관리자 1단계)
 * - 팀장: 인사관리자 (1단계)
 * - 인사관리자: 대표 (1단계)
 * - 대표: 본인 결재
 * 반환 [1단계, 2단계?] (중복 제거).
 */
function buildLeaveChain(
  role: Role,
  selfId: string,
  teamLeaderId: string | null,
  hrId: string | null
): string[] {
  if (role === "admin") return [selfId]; // 대표: 본인 결재
  if (role === "hr_manager") return [teamLeaderId ?? selfId]; // 인사관리자 → 대표(본인 결재자)
  if (role === "approver") return [hrId ?? selfId]; // 팀장 → 인사관리자

  // 팀원: 팀장 → 인사관리자
  const chain: string[] = [];
  for (const id of [teamLeaderId, hrId]) {
    if (id && !chain.includes(id)) chain.push(id);
  }
  return chain.length ? chain : [selfId];
}

/** 직원: 연차/반차/시차 신청 (결재선 자동 구성) */
export async function submitLeave(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const leaveType = String(formData.get("leave_type") ?? "full") as LeaveType;
  if (!LEAVE_TYPES.includes(leaveType)) throw new Error("연차 종류가 올바르지 않습니다.");

  const start = String(formData.get("start_date") ?? "");
  // 반차·시차는 단일 날짜
  const end = isSingleDayType(leaveType) ? start : String(formData.get("end_date") ?? start);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!start) throw new Error("날짜를 선택하세요.");
  if (new Date(end) < new Date(start)) throw new Error("종료일이 시작일보다 빠릅니다.");

  // 직속 결재자(팀장/인사관리자의 상위) + 인사관리자 id 확인
  const [{ data: me }, { data: dir }] = await Promise.all([
    supabase.from("users").select("approver_id").eq("id", user.id).single(),
    supabase.rpc("user_directory"),
  ]);
  const hr = ((dir ?? []) as { id: string; role: string }[]).find(
    (u) => u.role === "hr_manager"
  );
  const chain = buildLeaveChain(user.role, user.id, me?.approver_id ?? null, hr?.id ?? null);

  const days = countLeaveDays(start, end, leaveType);
  if (days <= 0) throw new Error("신청 일수가 0일입니다. 평일을 선택하세요.");

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: start,
    end_date: end,
    days,
    half_day: leaveType === "half_am" || leaveType === "half_pm",
    leave_type: leaveType,
    reason,
    approver_id: chain[0],
    next_approver_id: chain[1] ?? null,
    stage: 1,
  });
  if (error) throw new Error("신청 저장에 실패했습니다.");
  revalidatePath("/leave");
}

/** 결재자: 승인 (다음 결재자가 있으면 이관, 없으면 최종 승인) */
export async function approveLeave(id: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_advance", {
    p_id: id,
    p_approve: true,
  });
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}

/** 결재자: 반려 (사유 필수, 1인이라도 반려 시 즉시 종결) */
export async function rejectLeave(id: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_advance", {
    p_id: id,
    p_approve: false,
    p_reason: trimmed,
  });
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}

/** 신청자: 승인 전(대기) 본인 신청 회수 */
export async function withdrawLeave(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("회수에 실패했습니다.");
  revalidatePath("/leave");
}
