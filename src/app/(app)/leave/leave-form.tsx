"use client";

import { useState } from "react";
import { submitLeave } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LEAVE_TYPES,
  LEAVE_TYPE_DESC,
  isSingleDayType,
  type LeaveType,
} from "@/lib/leave/types";

export function LeaveForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("full");
  const single = isSingleDayType(leaveType);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitLeave(formData);
      (document.getElementById("leave-form") as HTMLFormElement)?.reset();
      setLeaveType("full");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="leave-form" action={action} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="leave_type">종류</Label>
        <select
          id="leave_type"
          name="leave_type"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>{LEAVE_TYPE_DESC[t]}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="start_date">{single ? "날짜" : "시작일"}</Label>
        <Input id="start_date" name="start_date" type="date" required />
      </div>
      {!single && (
        <div className="space-y-2">
          <Label htmlFor="end_date">종료일</Label>
          <Input id="end_date" name="end_date" type="date" required />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="reason">사유</Label>
        <Input id="reason" name="reason" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "제출 중..." : "연차 신청"}</Button>
    </form>
  );
}
