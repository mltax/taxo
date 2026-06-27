export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "회수됨",
};

export interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  reason: string;
  status: LeaveStatus;
  approver_id: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
}
