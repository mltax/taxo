"use client";

import { useState } from "react";
import { withdrawClaim } from "@/lib/welfare/actions";
import { Button } from "@/components/ui/button";

export function WithdrawClaimButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (!confirm("이 신청을 회수하시겠습니까?")) return;
        setBusy(true);
        await withdrawClaim(id);
        setBusy(false);
      }}
    >
      회수
    </Button>
  );
}
