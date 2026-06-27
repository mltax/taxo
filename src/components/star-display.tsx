/** 평균 별점 읽기 전용 표시 */
export function StarDisplay({ avg, count }: { avg: number; count: number }) {
  const filled = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-amber-500" aria-hidden>
        {"★".repeat(filled)}
        <span className="text-muted-foreground/40">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="text-muted-foreground">
        {count > 0 ? `${avg.toFixed(1)} (${count}명)` : "평가 없음"}
      </span>
    </span>
  );
}
