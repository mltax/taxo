"use client";

import { useState } from "react";
import { submitClaim } from "@/lib/welfare/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WelfareItem } from "@/lib/welfare/types";

export function ClaimForm({ items }: { items: WelfareItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitClaim(formData);
      (document.getElementById("claim-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="claim-form" action={action} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="item_id">복지 항목</Label>
        <select id="item_id" name="item_id" required className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">선택하세요</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">금액 (원)</Label>
        <Input id="amount" name="amount" type="number" min="1" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">사유</Label>
        <Input id="reason" name="reason" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">증빙 첨부 (선택)</Label>
        <Input id="file" name="file" type="file" accept="image/*,application/pdf" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "제출 중..." : "제출하기"}</Button>
    </form>
  );
}
