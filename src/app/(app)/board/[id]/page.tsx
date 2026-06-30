import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAdmin, canEditPost, canDeletePost, type BoardType } from "@/lib/roles";
import { getNameMap } from "@/lib/users/directory";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StarDisplay } from "@/components/star-display";
import { RateStars } from "./rate-stars";
import { RewardInput } from "./reward-input";
import { PostActions } from "./post-actions";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: post }, nameMap] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, category, body, is_notice, board_type, reward_points, author_id, created_at")
      .eq("id", id)
      .single(),
    getNameMap(),
  ]);
  if (!post) notFound();

  const backHref = post.board_type === "free" ? "/board/free" : "/board/work";
  const isAuthor = post.author_id === user.id;
  const canEdit = canEditPost(user.role, post.board_type as BoardType, isAuthor);
  const canDelete = canDeletePost(user.role, post.board_type as BoardType, isAuthor);

  // 업무공유 글: 평균 별점 + 내 투표 조회
  const isWork = post.board_type === "work";
  let avg = 0, voteCount = 0, myScore: number | null = null;
  if (isWork) {
    const [{ data: summary }, { data: mine }] = await Promise.all([
      supabase.rpc("post_rating_summary", { p_post_id: id }),
      supabase.from("post_ratings").select("score").eq("post_id", id).eq("voter_id", user.id).maybeSingle(),
    ]);
    const row = Array.isArray(summary) ? summary[0] : summary;
    avg = Number(row?.avg_score ?? 0);
    voteCount = Number(row?.vote_count ?? 0);
    myScore = mine?.score ?? null;
  }

  const { data: files } = await supabase
    .from("post_files")
    .select("id, file_path, file_name")
    .eq("post_id", id);

  // 첨부 파일별 서명 URL (60초)
  const filesWithUrl = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(f.file_path, 60, { download: f.file_name });
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const author = nameMap.get(post.author_id) ?? "-";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={backHref} className="text-sm text-muted-foreground hover:underline">← 목록</Link>
        <PostActions postId={post.id} canEdit={canEdit} canDelete={canDelete} />
      </div>
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

          {isWork && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-semibold">평가</p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">평균</div>
                  <StarDisplay avg={avg} count={voteCount} />
                </div>
                <RateStars postId={post.id} myScore={myScore} />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-sm font-medium">포상 포인트:</span>
                {post.reward_points ? (
                  <Badge className="text-sm">{post.reward_points.toLocaleString()}P</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">미부여</span>
                )}
                {canAdmin(user.role) && (
                  <RewardInput postId={post.id} current={post.reward_points} />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
