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

/** 연차 사용 일수. 반차면 0.5, 아니면 start~end 평일(월~금) 수. */
export function countLeaveDays(start: string, end: string, halfDay: boolean): number {
  if (halfDay) return 0.5;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  let count = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay(); // 0=일,6=토
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
