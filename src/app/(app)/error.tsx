"use client";

import { Button } from "@/components/ui/button";

/** 앱 페이지 렌더 오류 시 크래시(빈 화면) 대신 보여지는 폴백 — 재시도 제공. */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-lg font-semibold">문제가 발생했습니다</p>
      <p className="max-w-md text-sm text-muted-foreground">
        페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <Button onClick={reset} variant="outline" size="sm">
        다시 시도
      </Button>
    </div>
  );
}
