import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, category, body, is_notice, board_type, created_at, users:author_id(name)")
    .eq("id", id)
    .single();
  if (!post) notFound();

  const backHref = post.board_type === "free" ? "/board/free" : "/board/work";

  const { data: files } = await supabase
    .from("post_files")
    .select("id, file_path, file_name")
    .eq("post_id", id);

  // 첨부 파일별 서명 URL (60초)
  const filesWithUrl = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(f.file_path, 60);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const author = (post as any).users?.name ?? "-";

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm text-muted-foreground hover:underline">← 목록</Link>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{post.category}</Badge>
            {post.is_notice && <Badge>공지</Badge>}
          </div>
          <CardTitle className="text-xl">{post.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {author} · {post.created_at?.slice(0, 10)}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="whitespace-pre-wrap text-sm">{post.body || "(내용 없음)"}</div>
          {filesWithUrl.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">첨부 파일</p>
              {filesWithUrl.map((f) => (
                <div key={f.id}>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      📎 {f.file_name}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">📎 {f.file_name} (다운로드 불가)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
