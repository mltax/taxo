"use client";

import { useState } from "react";
import { generateGrants, setHireDate, setGrant } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GenerateButton({ year }: { year: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy}
      onClick={async () => { setBusy(true); await generateGrants(year); setBusy(false); }}>
      {busy ? "산정 중..." : `${year}년 연차 일괄 산정`}
    </Button>
  );
}

export function HireDateInput({ userId, hireDate }: { userId: string; hireDate: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <Input type="date" defaultValue={hireDate ?? ""} disabled={busy} className="h-8 w-40"
      onBlur={async (e) => { setBusy(true); await setHireDate(userId, e.target.value); setBusy(false); }} />
  );
}

export function GrantInput({ userId, year, days }: { userId: string; year: number; days: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <Input type="number" step="0.5" min="0" defaultValue={days} disabled={busy} className="h-8 w-24"
      onBlur={async (e) => { setBusy(true); await setGrant(userId, year, Number(e.target.value)); setBusy(false); }} />
  );
}
