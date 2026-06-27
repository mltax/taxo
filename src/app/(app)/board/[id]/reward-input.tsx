"use client";

import { useState } from "react";
import { setRewardPoints } from "@/lib/board/rating-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RewardInput({ postId, current }: { postId: string; current: number | null }) {
  const [val, setVal] = useState(current?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min={1000}
        max={20000}
        step={100}
        value={val}
        onChange={(e) => { setVal(e.target.value); setOk(false); }}
        placeholder="1000~20000"
        className="h-9 w-36"
      />
      <span className="text-sm text-muted-foreground">P</span>
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setOk(false);
          setBusy(true);
          try {
            await setRewardPoints(postId, Number(val));
            setOk(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
          } finally {
            setBusy(false);
          }
        }}
      >
        등록
      </Button>
      {ok && <span className="text-xs text-green-600">등록 완료</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
