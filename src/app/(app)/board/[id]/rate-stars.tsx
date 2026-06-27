"use client";

import { useState } from "react";
import { ratePost } from "@/lib/board/rating-actions";

export function RateStars({ postId, myScore }: { postId: string; myScore: number | null }) {
  const [score, setScore] = useState<number | null>(myScore);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const display = hover || score || 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onClick={async () => {
              setBusy(true);
              await ratePost(postId, n);
              setScore(n);
              setBusy(false);
            }}
            aria-label={`${n}점`}
            className={`text-2xl leading-none ${n <= display ? "text-amber-500" : "text-muted-foreground/40"}`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {score ? `내 평가: ${score}점` : "별을 눌러 평가 (익명, 1회)"}
      </span>
    </div>
  );
}
