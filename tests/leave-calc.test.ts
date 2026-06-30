import { describe, it, expect } from "vitest";
import { computeLegalLeave, countLeaveDays, formatDays } from "@/lib/leave/calc";

describe("computeLegalLeave (입사일·한국법, 대상연도 1/1 기준)", () => {
  it("만 1년·2년 = 15일", () => {
    expect(computeLegalLeave("2025-01-01", 2026)).toBe(15); // 1년
    expect(computeLegalLeave("2024-01-01", 2026)).toBe(15); // 2년
  });
  it("3·4년 = 16, 5·6년 = 17", () => {
    expect(computeLegalLeave("2023-01-01", 2026)).toBe(16); // 3년
    expect(computeLegalLeave("2022-01-01", 2026)).toBe(16); // 4년
    expect(computeLegalLeave("2021-01-01", 2026)).toBe(17); // 5년
  });
  it("한도 25일", () => {
    expect(computeLegalLeave("2000-01-01", 2026)).toBe(25);
  });
  it("1년 미만(작년 입사) = 완성 개월수, 최대 11", () => {
    expect(computeLegalLeave("2025-07-01", 2026)).toBe(6);  // 7~12월=6개월
    expect(computeLegalLeave("2025-02-01", 2026)).toBe(11); // 11개월→11 한도
  });
  it("대상연도에 입사(미입사) = 0", () => {
    expect(computeLegalLeave("2026-03-01", 2026)).toBe(0);
  });
});

describe("countLeaveDays (1일=8시간 기준)", () => {
  it("오전반차·오후반차 = 0.5", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-01", "half_am")).toBe(0.5);
    expect(countLeaveDays("2026-06-01", "2026-06-01", "half_pm")).toBe(0.5);
  });
  it("시차: 1시간=0.125, 2시간=0.25, 3시간=0.375", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-01", "hourly_1")).toBe(0.125);
    expect(countLeaveDays("2026-06-01", "2026-06-01", "hourly_2")).toBe(0.25);
    expect(countLeaveDays("2026-06-01", "2026-06-01", "hourly_3")).toBe(0.375);
  });
  it("종일 단일 평일 = 1", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-01", "full")).toBe(1); // 월요일
  });
  it("종일 주말 제외 평일 카운트", () => {
    // 2026-06-01(월)~06-05(금)=5, 06-06(토)·07(일) 제외
    expect(countLeaveDays("2026-06-01", "2026-06-07", "full")).toBe(5);
  });
  it("종일 토~일 구간 = 0", () => {
    expect(countLeaveDays("2026-06-06", "2026-06-07", "full")).toBe(0);
  });
});

describe("formatDays", () => {
  it("정수는 그대로, 소수는 분수 표기", () => {
    expect(formatDays(1)).toBe("1일");
    expect(formatDays(0.5)).toBe("0.5일");
    expect(formatDays(0.375)).toBe("0.375일");
    expect(formatDays(2.125)).toBe("2.125일");
  });
});
