"use client";

import { useState } from "react";
import { approveClaim, rejectClaim, markPaid } from "@/lib/welfare/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PendingActions({ claimId }: { claimId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {!rejecting ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await approveClaim(claimId); setBusy(false); }}>
            승인
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting(true)}>
            반려
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유" className="h-8" />
          <Button size="sm" variant="destructive" disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); await rejectClaim(claimId, reason); setBusy(false); }}>
            확인
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>취소</Button>
        </div>
      )}
    </div>
  );
}

export function PayAction({ claimId }: { claimId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await markPaid(claimId); setBusy(false); }}>
      지급 완료 처리
    </Button>
  );
}
