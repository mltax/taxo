"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";
import { countLeaveDays } from "@/lib/leave/calc";

/** 직원: 연차/반차 신청 (직속 결재자에게 라우팅) */
export async function submitLeave(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const start = String(formData.get("start_date") ?? "");
  const halfDay = formData.get("half_day") === "on";
  const end = halfDay ? start : String(formData.get("end_date") ?? start);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!start) throw new Error("시작일을 선택하세요.");
  if (new Date(end) < new Date(start)) throw new Error("종료일이 시작일보다 빠릅니다.");

  // 직속 결재자 확인
  const { data: me } = await supabase
    .from("users")
    .select("approver_id")
    .eq("id", user.id)
    .single();
  if (!me?.approver_id) {
    throw new Error("직속 결재자가 지정되지 않았습니다. 관리자에게 문의하세요.");
  }

  const days = countLeaveDays(start, end, halfDay);
  if (days <= 0) throw new Error("신청 일수가 0일입니다. 평일을 선택하세요.");

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: start,
    end_date: end,
    days,
    half_day: halfDay,
    reason,
    approver_id: me.approver_id,
  });
  if (error) throw new Error("신청 저장에 실패했습니다.");
  revalidatePath("/leave");
}

/** 결재자: 승인 */
export async function approveLeave(id: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}

/** 결재자: 반려 (사유 필수) */
export async function rejectLeave(id: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "rejected", reject_reason: trimmed })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}
