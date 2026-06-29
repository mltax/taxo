"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove, canAdmin } from "@/lib/roles";
import { MAX_ATTACHMENT_BYTES } from "@/lib/welfare/constants";
import { safeStorageKey } from "@/lib/storage";

/** 직원: 복지 청구 신청 (pending 생성 + 증빙 업로드) */
export async function submitClaim(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const itemId = String(formData.get("item_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!itemId) throw new Error("복지 항목을 선택하세요.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("금액을 올바르게 입력하세요.");
  if (!reason) throw new Error("사유를 입력하세요.");
  if (file && file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("첨부파일은 5MB 이하만 가능합니다.");
  }

  // 청구 생성 (status 기본값 pending)
  const { data: claim, error } = await supabase
    .from("welfare_claims")
    .insert({ user_id: user.id, item_id: itemId, amount, reason })
    .select("id")
    .single();
  if (error || !claim) throw new Error("신청 저장에 실패했습니다.");

  // 증빙 파일 업로드 (선택)
  if (file && file.size > 0) {
    const path = safeStorageKey(`${user.id}/${claim.id}`, file.name);
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
    if (upErr) throw new Error("증빙 업로드에 실패했습니다.");
    await supabase
      .from("attachments")
      .insert({ claim_id: claim.id, file_path: path, file_name: file.name });
  }

  revalidatePath("/welfare");
}

/** 결재자/관리자: 승인 */
export async function approveClaim(claimId: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "approved", approver_id: user.id, approved_at: new Date().toISOString() })
    .eq("id", claimId)
    .eq("status", "pending"); // 동시성: 대기중일 때만
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}

/** 결재자/관리자: 반려 (사유 필수) */
export async function rejectClaim(claimId: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "rejected", approver_id: user.id, reject_reason: trimmed })
    .eq("id", claimId)
    .eq("status", "pending");
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}

/** 관리자: 지급 완료 처리 */
export async function markPaid(claimId: string) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("지급 처리 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", claimId)
    .eq("status", "approved");
  if (error) throw new Error("지급 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}

/** 신청자: 승인 전(대기) 본인 신청 회수 */
export async function withdrawClaim(claimId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "cancelled" })
    .eq("id", claimId)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("회수에 실패했습니다.");
  revalidatePath("/welfare");
}
