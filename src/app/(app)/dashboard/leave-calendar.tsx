"use client";

import { useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { fetchLeaveCalendar } from "@/lib/leave/actions";
import {
  fetchCalendarEvents,
  addCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/calendar/actions";
import type { LeaveCalendarEvent } from "@/lib/leave/calendar";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { LeaveType } from "@/lib/leave/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

/** 종류별 칩 색상 — 연차(종일)는 기존 그대로, 반차는 옅은 보라, 시차는 옅은 아이보리 */
function chipClass(t: LeaveType): string {
  if (t === "half_am" || t === "half_pm")
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
  if (t === "hourly_1" || t === "hourly_2" || t === "hourly_3")
    return "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-200";
  return "bg-primary/10 text-primary"; // 연차(종일)
}

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
  initialLeaves,
  initialEvents,
  canManage,
}: {
  initialYear: number;
  initialMonth: number;
  initialLeaves: LeaveCalendarEvent[];
  initialEvents: CalendarEvent[];
  canManage: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [leaves, setLeaves] = useState(initialLeaves);
  const [events, setEvents] = useState(initialEvents);
  const [pending, startTransition] = useTransition();

  // 일정 추가 폼 상태
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [evStart, setEvStart] = useState(ymd(new Date()));
  const [evEnd, setEvEnd] = useState(ymd(new Date()));
  const [error, setError] = useState("");

  const todayStr = ymd(new Date());
  const cells = buildCells(year, month);

  function go(y: number, m: number) {
    startTransition(async () => {
      const [lv, ev] = await Promise.all([
        fetchLeaveCalendar(y, m),
        fetchCalendarEvents(y, m),
      ]);
      setYear(y);
      setMonth(m);
      setLeaves(lv);
      setEvents(ev);
    });
  }
  const prev = () => go(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  const next = () => go(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  const today = () => {
    const now = new Date();
    go(now.getFullYear(), now.getMonth() + 1);
  };

  function saveEvent() {
    const t = title.trim();
    if (!t) return setError("일정명을 입력하세요.");
    if (t.length > 10) return setError("일정명은 10자 이내입니다.");
    if (!evStart || !evEnd) return setError("기간을 입력하세요.");
    if (evEnd < evStart) return setError("종료일이 시작일보다 빠릅니다.");
    setError("");
    startTransition(async () => {
      try {
        await addCalendarEvent({ title: t, startDate: evStart, endDate: evEnd });
        setEvents(await fetchCalendarEvents(year, month));
        setTitle("");
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      }
    });
  }

  function removeEvent(id: string) {
    startTransition(async () => {
      await deleteCalendarEvent(id);
      setEvents(await fetchCalendarEvents(year, month));
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            연차 캘린더 · {year}년 {month}월
          </CardTitle>
          <div className="flex items-center gap-1">
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding((v) => !v);
                  setError("");
                }}
                disabled={pending}
              >
                <PlusIcon /> 일정 추가
              </Button>
            )}
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
        {canManage && adding && (
          <div className="mb-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                시작일
                <Input type="date" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="h-8 w-auto" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                종료일
                <Input type="date" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="h-8 w-auto" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                일정명 (10자 이내)
                <Input
                  value={title}
                  maxLength={10}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 전사 회의"
                  className="h-8 w-40"
                />
              </label>
              <Button size="sm" onClick={saveEvent} disabled={pending}>
                저장
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
                disabled={pending}
              >
                취소
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        )}
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
            const dayLeaves = leaves.filter(
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
                  {/* 공유 일정 (회의·교육·세미나 등) */}
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[11px] leading-tight text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      title={ev.title}
                    >
                      <span className="truncate">{ev.title}</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeEvent(ev.id)}
                          disabled={pending}
                          aria-label="일정 삭제"
                          className="ml-auto shrink-0 opacity-50 hover:opacity-100"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayEvents.length - 2} 일정
                    </div>
                  )}
                  {/* 연차 */}
                  {dayLeaves.slice(0, 3).map((e) => (
                    <div
                      key={e.userId + e.startDate}
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chipClass(e.leaveType)}`}
                      title={`${e.name} · ${SHORT_TYPE[e.leaveType]}`}
                    >
                      {e.name}
                      <span className="opacity-70"> {SHORT_TYPE[e.leaveType]}</span>
                    </div>
                  ))}
                  {dayLeaves.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayLeaves.length - 3}명
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/25" />연차
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-200 dark:bg-violet-500/40" />반차
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-200 bg-amber-50 dark:bg-amber-400/25" />시차
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-500/40" />일정
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          승인 완료된 연차만 표시됩니다. (신청·대기 중 연차는 결재 완료 후 반영)
        </p>
      </CardContent>
    </Card>
  );
}
