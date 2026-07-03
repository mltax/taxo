import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/leave/types";

export interface LeaveCalendarEvent {
  userId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: LeaveType;
  days: number;
}

const KST_YM_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** KST 기준 현재 연·월 (서버 시간이 UTC여도 한국 기준으로 맞춤) */
export function kstToday(): { year: number; month: number } {
  const [y, m] = KST_YM_FMT.format(new Date()).split("-").map(Number);
  return { year: y, month: m };
}

/** 로컬 시간 기준 YYYY-MM-DD (toISOString의 UTC 변환 회피) */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 월(month: 1~12)을 감싸는 6주 그리드(일요일 시작)의 시작·끝 날짜 */
export function monthGridRange(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month - 1, 1);
  const gridStart = new Date(year, month - 1, 1 - first.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 41); // 6주 × 7일 = 42칸
  return { from: ymd(gridStart), to: ymd(gridEnd) };
}

/** 전 직원 승인 연차 — 해당 월 그리드 범위와 겹치는 이벤트 */
export async function getLeaveCalendarEvents(
  year: number,
  month: number
): Promise<LeaveCalendarEvent[]> {
  const { from, to } = monthGridRange(year, month);
  const supabase = await createClient();
  const { data } = await supabase.rpc("leave_calendar", { p_from: from, p_to: to });
  return (
    (data ?? []) as {
      user_id: string;
      name: string;
      start_date: string;
      end_date: string;
      leave_type: LeaveType;
      days: number | string;
    }[]
  ).map((r) => ({
    userId: r.user_id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    leaveType: r.leave_type,
    days: Number(r.days),
  }));
}
