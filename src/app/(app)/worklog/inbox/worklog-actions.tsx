"use client";

import { useState } from "react";
import { approveWorkLog, rejectWorkLog } from "@/lib/worklog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WorkLogActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (rejecting) {
    return (
      <div className="flex gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유" className="h-8" />
        <Button size="sm" variant="destructive" disabled={busy || !reason.trim()}
          onClick={async () => { setBusy(true); await rejectWorkLog(id, reason); setBusy(false); }}>확인</Button>
        <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>취소</Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await approveWorkLog(id); setBusy(false); }}>승인</Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting(true)}>반려</Button>
    </div>
  );
}
