"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";
import { safeStorageKey } from "@/lib/storage";

/** 직원: 업무일지 작성 (지정 결재자에게 제출, 파일 첨부 가능) */
export async function submitWorkLog(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const logDate = String(formData.get("log_date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const approverId = String(formData.get("approver_id") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!logDate) throw new Error("날짜를 선택하세요.");
  if (!content) throw new Error("업무 내용을 입력하세요.");
  if (!approverId) throw new Error("결재자를 선택하세요.");
  if (approverId === user.id) throw new Error("본인을 결재자로 지정할 수 없습니다.");

  const { data: log, error } = await supabase
    .from("work_logs")
    .insert({ user_id: user.id, log_date: logDate, title, content, approver_id: approverId })
    .select("id")
    .single();
  if (error || !log) throw new Error("업무일지 저장에 실패했습니다.");

  for (const file of files) {
    const path = safeStorageKey(log.id, file.name);
    const { error: upErr } = await supabase.storage.from("worklog").upload(path, file);
    if (upErr) throw new Error(`파일 업로드 실패: ${file.name}`);
    await supabase
      .from("work_log_files")
      .insert({ work_log_id: log.id, file_path: path, file_name: file.name });
  }

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
