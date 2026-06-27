"use client";

import { useState } from "react";
import { submitLeave } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LeaveForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [halfDay, setHalfDay] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitLeave(formData);
      (document.getElementById("leave-form") as HTMLFormElement)?.reset();
      setHalfDay(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="leave-form" action={action} className="space-y-4 max-w-md">
      <div className="flex items-center gap-2">
        <input
          id="half_day"
          name="half_day"
          type="checkbox"
          className="h-4 w-4"
          checked={halfDay}
          onChange={(e) => setHalfDay(e.target.checked)}
        />
        <Label htmlFor="half_day">반차 (0.5일)</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="start_date">{halfDay ? "날짜" : "시작일"}</Label>
        <Input id="start_date" name="start_date" type="date" required />
      </div>
      {!halfDay && (
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
