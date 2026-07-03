"use client";

import { useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { fetchLeaveCalendar } from "@/lib/leave/actions";
import type { LeaveCalendarEvent } from "@/lib/leave/calendar";
import type { LeaveType } from "@/lib/leave/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜 칸 칩에 쓰는 짧은 종류 표기 */
const SHORT_TYPE: Record<LeaveType, string> = {
  full: "종일",
  half_am: "오전",
  half_pm: "오후",
  hourly_1: "1H",
  hourly_2: "2H",
  hourly_3: "3H",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 월을 감싸는 6주(42칸) 그리드 날짜 배열 (일요일 시작) */
function buildCells(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function LeaveCalendar({
  initialYear,
  initialMonth,
  initialEvents,
}: {
  initialYear: number;
  initialMonth: number;
  initialEvents: LeaveCalendarEvent[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState(initialEvents);
  const [pending, startTransition] = useTransition();

  const todayStr = ymd(new Date());
  const cells = buildCells(year, month);

  function go(y: number, m: number) {
    startTransition(async () => {
      const ev = await fetchLeaveCalendar(y, m);
      setYear(y);
      setMonth(m);
      setEvents(ev);
    });
  }
  const prev = () => go(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  const next = () => go(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  const today = () => {
    const now = new Date();
    go(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            연차 캘린더 · {year}년 {month}월
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={today} disabled={pending}>
              오늘
            </Button>
            <Button variant="outline" size="icon-sm" onClick={prev} disabled={pending} aria-label="이전 달">
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={next} disabled={pending} aria-label="다음 달">
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 overflow-hidden rounded-md border text-sm">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`border-b bg-muted/40 py-1.5 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const cellStr = ymd(d);
            const inMonth = d.getMonth() === month - 1;
            const isToday = cellStr === todayStr;
            const dow = i % 7;
            const dayEvents = events.filter(
              (e) => e.startDate <= cellStr && cellStr <= e.endDate
            );
            return (
              <div
                key={cellStr}
                className={`min-h-20 border-b border-l p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${
                  inMonth ? "" : "bg-muted/20"
                } ${pending ? "opacity-60" : ""}`}
              >
                <div
                  className={`mb-0.5 text-right text-xs ${
                    isToday
                      ? "font-bold text-primary"
                      : !inMonth
                        ? "text-muted-foreground/50"
                        : dow === 0
                          ? "text-red-500"
                          : dow === 6
                            ? "text-blue-500"
                            : "text-muted-foreground"
                  }`}
                >
                  {isToday ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {d.getDate()}
                    </span>
                  ) : (
                    d.getDate()
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.userId + e.startDate}
                      className="truncate rounded bg-primary/10 px-1 py-0.5 text-[11px] leading-tight text-primary"
                      title={`${e.name} · ${SHORT_TYPE[e.leaveType]}`}
                    >
                      {e.name}
                      <span className="text-primary/60"> {SHORT_TYPE[e.leaveType]}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayEvents.length - 3}명
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          승인 완료된 연차만 표시됩니다. (신청·대기 중 연차는 결재 완료 후 반영)
        </p>
      </CardContent>
    </Card>
  );
}
