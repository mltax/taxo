import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DownloadFile {
  name: string;
  url: string | null;
}

/** 서명 URL 다운로드 링크 목록 (증빙·첨부) */
export function FileLinks({ files }: { files?: DownloadFile[] }) {
  if (!files || files.length === 0) {
    return <span className="text-xs text-muted-foreground">없음</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {files.map((f, i) =>
        f.url ? (
          <a
            key={i}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            📎 {f.name}
          </a>
        ) : (
          <span key={i} className="text-xs text-muted-foreground">📎 {f.name}</span>
        )
      )}
    </div>
  );
}
