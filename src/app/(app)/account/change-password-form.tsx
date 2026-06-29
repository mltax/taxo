"use client";

import { useState } from "react";
import { changePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setOk(false);
    setPending(true);
    const res = await changePassword(formData);
    setPending(false);
    if (res.ok) {
      setOk(true);
      (document.getElementById("pw-form") as HTMLFormElement)?.reset();
    } else {
      setError(res.error ?? "오류가 발생했습니다.");
    }
  }

  return (
    <form id="pw-form" action={action} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="password">새 비밀번호 (6자 이상)</Label>
        <Input id="password" name="password" type="password" minLength={6} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">새 비밀번호 확인</Label>
        <Input id="confirm" name="confirm" type="password" minLength={6} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {ok && <p className="text-sm text-green-600">비밀번호가 변경되었습니다.</p>}
      <Button type="submit" disabled={pending}>{pending ? "변경 중..." : "비밀번호 변경"}</Button>
    </form>
  );
}
