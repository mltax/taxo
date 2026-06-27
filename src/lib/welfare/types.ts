import type { ClaimStatus } from "@/lib/welfare/state";

export interface WelfareItem {
  id: string;
  name: string;
  monthly_limit: number | null;
}

export interface WelfareClaim {
  id: string;
  user_id: string;
  item_id: string;
  amount: number;
  reason: string;
  status: ClaimStatus;
  approver_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "작성중",
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  paid: "지급 완료",
  cancelled: "회수됨",
};
