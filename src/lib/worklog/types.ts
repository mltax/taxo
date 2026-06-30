export type WorkLogStatus = "pending" | "approved" | "rejected";

export const WORKLOG_STATUS_LABEL: Record<WorkLogStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
};
