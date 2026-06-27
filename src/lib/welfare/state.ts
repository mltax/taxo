export type ClaimStatus = "draft" | "pending" | "approved" | "rejected" | "paid" | "cancelled";
export type ClaimAction = "approve" | "reject" | "pay";

const TRANSITIONS: Record<ClaimAction, { from: ClaimStatus; to: ClaimStatus }> = {
  approve: { from: "pending", to: "approved" },
  reject: { from: "pending", to: "rejected" },
  pay: { from: "approved", to: "paid" },
};

/** 허용된 전이면 다음 상태를 반환, 아니면 throw. */
export function nextStatus(current: ClaimStatus, action: ClaimAction): ClaimStatus {
  const t = TRANSITIONS[action];
  if (!t || t.from !== current) {
    throw new Error(`잘못된 상태 전이: ${current} -> ${action}`);
  }
  return t.to;
}
