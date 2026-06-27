"use client";

import { useState } from "react";
import { withdrawLeave } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";

export function WithdrawLeaveButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (!confirm("이 연차 신청을 회수하시겠습니까?")) return;
        setBusy(true);
        await withdrawLeave(id);
        setBusy(false);
      }}
    >
      회수
    </Button>
  );
}
