"use client";

import { useState } from "react";
import { setWelfareItemActive } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

export function ItemToggle({ itemId, isActive }: { itemId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "destructive"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setWelfareItemActive(itemId, !isActive);
        setBusy(false);
      }}
    >
      {isActive ? "비활성화" : "활성화"}
    </Button>
  );
}
