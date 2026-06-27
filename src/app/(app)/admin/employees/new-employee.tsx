"use client";

import { useState } from "react";
import { createEmployee } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewEmployee() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null); setOk(false); setPending(true);
    try {
      await createEmployee(formData);
      setOk(true);
      (document.getElementById("emp-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="emp-form" action={action} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">임시 비밀번호 (6자+)</Label>
        <Input id="password" name="password" minLength={6} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="department">소속 (선택)</Label>
        <Input id="department" name="department" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">역할</Label>
        <select id="role" name="role" className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="staff">직원</option>
          <option value="approver">결재자</option>
          <option value="hr_manager">인사관리자</option>
          <option value="admin">관리자</option>
        </select>
      </div>
      <div className="flex items-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "발급 중..." : "계정 발급"}</Button>
        {ok && <span className="text-sm text-green-600">발급 완료</span>}
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
    </form>
  );
}
