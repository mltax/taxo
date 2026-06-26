"use client";

import { useState } from "react";
import { addWelfareItem } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ItemForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null); setPending(true);
    try {
      await addWelfareItem(formData);
      (document.getElementById("item-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="item-form" action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="name">항목명</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="monthly_limit">월 한도 (원, 선택)</Label>
        <Input id="monthly_limit" name="monthly_limit" type="number" min="0" placeholder="무제한" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "추가 중..." : "항목 추가"}</Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
