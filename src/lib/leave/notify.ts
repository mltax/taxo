import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendKakaoworkDM,
  sendKakaoworkAnnounce,
  kakaoworkEnabled,
} from "@/lib/kakaowork/client";
import { LEAVE_TYPE_LABEL, type LeaveType } from "@/lib/leave/types";
import { formatDays } from "@/lib/leave/calc";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taxo-two.vercel.app";

interface LeaveRow {
  id: string;
  user_id: string;
  approver_id: string | null;
  start_date: string;
  end_date: string;
  days: number;
  leave_type: LeaveType;
  status: string;
  reject_reason: string | null;
}

/** 이메일 등 민감정보 조회는 RLS 우회가 필요하므로 서비스 롤(admin) 사용 (서버 전용) */
async function fetchLeave(id: string): Promise<LeaveRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("leave_requests")
    .select("id, user_id, approver_id, start_date, end_date, days, leave_type, status, reject_reason")
    .eq("id", id)
    .single();
  return (data as LeaveRow) ?? null;
}

async function fetchUser(id: string): Promise<{ name: string; email: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("users").select("name, email").eq("id", id).single();
  return (data as { name: string; email: string }) ?? null;
}

function period(l: LeaveRow): string {
  return l.start_date === l.end_date ? l.start_date : `${l.start_date} ~ ${l.end_date}`;
}

/** 현재 결재 차례인 결재자에게 '결재 요청' DM */
export async function notifyLeaveApprovalRequest(leaveId: string): Promise<void> {
  if (!kakaoworkEnabled()) return;
  const l = await fetchLeave(leaveId);
  if (!l?.approver_id) return;
  const [requester, approver] = await Promise.all([
    fetchUser(l.user_id),
    fetchUser(l.approver_id),
  ]);
  if (!approver?.email) return;
  const text =
    `🗓 [연차 결재 요청]\n` +
    `신청자: ${requester?.name ?? "-"}\n` +
    `기간: ${period(l)} (${LEAVE_TYPE_LABEL[l.leave_type]})\n` +
    `일수: ${formatDays(l.days)}일\n` +
    `▶ 결재하기: ${SITE_URL}/leave/inbox`;
  await sendKakaoworkDM(approver.email, text);
}

/** 신청자에게 승인/반려 결과 DM */
export async function notifyLeaveResult(
  leaveId: string,
  decision: "approved" | "rejected"
): Promise<void> {
  if (!kakaoworkEnabled()) return;
  const l = await fetchLeave(leaveId);
  if (!l) return;
  const requester = await fetchUser(l.user_id);
  if (!requester?.email) return;
  const text =
    decision === "approved"
      ? `✅ [연차 승인]\n기간: ${period(l)} (${LEAVE_TYPE_LABEL[l.leave_type]})\n일수: ${formatDays(l.days)}일\n연차가 최종 승인되었습니다.`
      : `❌ [연차 반려]\n기간: ${period(l)} (${LEAVE_TYPE_LABEL[l.leave_type]})\n사유: ${l.reject_reason ?? "-"}`;
  await sendKakaoworkDM(requester.email, text);
}

/** 지정 공지방에 연차 승인 공지 (사유 등 개인정보 제외 — 이름·기간·종류만) */
export async function announceLeaveApproved(leaveId: string): Promise<void> {
  if (!kakaoworkEnabled()) return;
  const l = await fetchLeave(leaveId);
  if (!l) return;
  const requester = await fetchUser(l.user_id);
  const text =
    `📢 [연차 승인 안내]\n` +
    `${requester?.name ?? "-"} 님\n` +
    `기간: ${period(l)} (${LEAVE_TYPE_LABEL[l.leave_type]})\n` +
    `일수: ${formatDays(l.days)}일`;
  await sendKakaoworkAnnounce(text);
}

/** 결재 진행(leave_advance) 이후 결과 상태에 따라 알림 분기 */
export async function notifyLeaveAdvanced(leaveId: string): Promise<void> {
  if (!kakaoworkEnabled()) return;
  const l = await fetchLeave(leaveId);
  if (!l) return;
  if (l.status === "approved") {
    // 최종 승인: 신청자에게 결과 + 공지방 안내
    await notifyLeaveResult(leaveId, "approved");
    await announceLeaveApproved(leaveId);
  } else if (l.status === "pending") {
    // 다음 단계로 이관됨: 새 결재자에게 결재 요청
    await notifyLeaveApprovalRequest(leaveId);
  }
}
