"use client";

import { useState } from "react";
import { submitWorkLog } from "@/lib/worklog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Approver {
  id: string;
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  approver: "팀장",
  hr_manager: "인사관리자",
  admin: "대표",
};

export function WorkLogForm({
  approvers,
  defaultApproverId,
}: {
  approvers: Approver[];
  defaultApproverId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitWorkLog(formData);
      (document.getElementById("worklog-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form id="worklog-form" action={action} className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="log_date">날짜</Label>
        <Input id="log_date" name="log_date" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">제목 (선택)</Label>
        <Input id="title" name="title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">업무 내용</Label>
        <textarea id="content" name="content" rows={8} required className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="approver_id">결재자</Label>
        <select id="approver_id" name="approver_id" defaultValue={defaultApproverId} required className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">선택하세요</option>
          {approvers.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({ROLE_LABEL[a.role] ?? a.role})</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">첨부 파일 (여러 개 가능)</Label>
        <Input id="files" name="files" type="file" multiple />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "제출 중..." : "업무일지 제출"}</Button>
    </form>
  );
}
