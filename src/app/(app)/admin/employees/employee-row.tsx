"use client";

import { useState } from "react";
import { setEmployeeActive, setEmployeeRole } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles";

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [busy, setBusy] = useState(false);
  return (
    <select
      defaultValue={role}
      disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => {
        setBusy(true);
        await setEmployeeRole(userId, e.target.value as Role);
        setBusy(false);
      }}
    >
      <option value="staff">직원</option>
      <option value="approver">결재자</option>
      <option value="admin">관리자</option>
    </select>
  );
}

export function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "destructive"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setEmployeeActive(userId, !isActive);
        setBusy(false);
      }}
    >
      {isActive ? "비활성화" : "활성화"}
    </Button>
  );
}
