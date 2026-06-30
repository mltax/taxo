"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";

/** 직원: 업무일지 작성 (지정 결재자에게 제출) */
export async function submitWorkLog(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const logDate = String(formData.get("log_date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const approverId = String(formData.get("approver_id") ?? "");

  if (!logDate) throw new Error("날짜를 선택하세요.");
  if (!content) throw new Error("업무 내용을 입력하세요.");
  if (!approverId) throw new Error("결재자를 선택하세요.");
  if (approverId === user.id) throw new Error("본인을 결재자로 지정할 수 없습니다.");

  const { error } = await supabase.from("work_logs").insert({
    user_id: user.id,
    log_date: logDate,
    title,
    content,
    approver_id: approverId,
  });
  if (error) throw new Error("업무일지 저장에 실패했습니다.");
  revalidatePath("/worklog");
}

/** 결재자: 승인 */
export async function approveWorkLog(id: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_logs")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/worklog/inbox");
}

/** 결재자: 반려 (사유 필수) */
export async function rejectWorkLog(id: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_logs")
    .update({ status: "rejected", reject_reason: trimmed })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/worklog/inbox");
}
