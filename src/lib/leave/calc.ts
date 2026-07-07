/** 입사일(YYYY-MM-DD)과 대상 연도로 법정 연차 일수를 계산. 대상연도 1/1 기준 완성 근속. */
export function computeLegalLeave(hireDate: string, targetYear: number): number {
  const hire = new Date(hireDate + "T00:00:00Z");
  const jan1 = new Date(Date.UTC(targetYear, 0, 1));

  // 완성 개월수 (1/1 기준)
  const months =
    (jan1.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
    (jan1.getUTCMonth() - hire.getUTCMonth()) -
    (jan1.getUTCDate() < hire.getUTCDate() ? 1 : 0);

  if (months <= 0) return 0; // 대상연도 입사/미입사
  if (months < 12) return Math.min(11, months); // 1년 미만: 월 1일, 한도 11

  const years = Math.floor(months / 12);
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}

import type { LeaveType } from "@/lib/leave/types";

const HOURS_PER_DAY = 8;

/** 연차 종류별 차감 시간 (종일 제외) */
const LEAVE_TYPE_HOURS: Record<Exclude<LeaveType, "full">, number> = {
  half_am: 4,
  half_pm: 4,
  hourly_1: 1,
  hourly_2: 2,
  hourly_3: 3,
};

/**
 * 연차 사용 일수 (1일=8시간 기준).
 * - 종일: start~end 평일(월~금) 수 × 1일
 * - 반차: 0.5일 / 시차: 시간/8일
 */
export function countLeaveDays(start: string, end: string, type: LeaveType): number {
  if (type !== "full") return LEAVE_TYPE_HOURS[type] / HOURS_PER_DAY;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  let count = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay(); // 0=일,6=토
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/** 분수(소수) 일수를 보기 좋게 표기. 예: 1 → "1일", 0.375 → "0.375일" */
export function formatDays(days: number): string {
  const n = Number(days);
  const text = Number.isInteger(n)
    ? String(n)
    : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}일`;
}

/** 일수를 시간으로 환산 표기. 예: 0.375 → "3시간" */
export function formatHours(days: number): string {
  return `${Number(days) * HOURS_PER_DAY}시간`;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD → "YYYY-MM-DD(요일)". 파싱 실패 시 원본 반환. */
export function formatDateKo(dateStr: string): string {
  if (!dateStr) return dateStr;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${dateStr}(${WEEKDAY_KO[d.getDay()]})`;
}

/** 기간 표기: 단일일이면 하나, 범위면 "start ~ end" (각 날짜에 요일 포함) */
export function formatPeriodKo(start: string, end: string): string {
  return start === end
    ? formatDateKo(start)
    : `${formatDateKo(start)} ~ ${formatDateKo(end)}`;
}
