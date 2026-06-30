export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "회수됨",
};

/** 연차 종류 (1일=8시간 기준 차감) */
export type LeaveType =
  | "full"
  | "half_am"
  | "half_pm"
  | "hourly_1"
  | "hourly_2"
  | "hourly_3";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  full: "종일",
  half_am: "오전반차",
  half_pm: "오후반차",
  hourly_1: "1시간 시차",
  hourly_2: "2시간 시차",
  hourly_3: "3시간 시차",
};

/** 선택 화면용 설명(시간대·차감일수) */
export const LEAVE_TYPE_DESC: Record<LeaveType, string> = {
  full: "종일 (8시간 = 1일)",
  half_am: "오전반차 (09:00~12:30, 0.5일)",
  half_pm: "오후반차 (12:30~18:00, 0.5일)",
  hourly_1: "1시간 시차 (0.125일)",
  hourly_2: "2시간 시차 (0.25일)",
  hourly_3: "3시간 시차 (0.375일)",
};

/** 종일이 아니면 단일 날짜 신청 */
export function isSingleDayType(t: LeaveType): boolean {
  return t !== "full";
}

export const LEAVE_TYPES: LeaveType[] = [
  "full",
  "half_am",
  "half_pm",
  "hourly_1",
  "hourly_2",
  "hourly_3",
];

export interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  leave_type: LeaveType;
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
