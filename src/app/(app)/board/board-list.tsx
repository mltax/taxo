import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { getNameMap } from "@/lib/users/directory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StarDisplay } from "@/components/star-display";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export async function BoardList({
  boardType,
  title,
}: {
  boardType: "free" | "work";
  title: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const isWork = boardType === "work";

  const [{ data: posts }, nameMap] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, category, is_notice, created_at, author_id")
      .eq("board_type", boardType)
      .order("is_notice", { ascending: false })
      .order("created_at", { ascending: false }),
    getNameMap(supabase),
  ]);

  // 업무공유: 글별 평균 별점
  const ratingByPost = new Map<string, { avg: number; count: number }>();
  if (isWork) {
    const { data: summaries } = await supabase.rpc("work_post_rating_summaries");
    for (const s of (summaries ?? []) as any[]) {
      ratingByPost.set(s.post_id, { avg: Number(s.avg_score), count: Number(s.vote_count) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {canApprove(user.role) && (
          <Link href={`/board/new?type=${boardType}`}><Button>글쓰기</Button></Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">분류</TableHead>
            <TableHead>제목</TableHead>
            {isWork && <TableHead className="w-40">평가</TableHead>}
            <TableHead className="w-28">작성자</TableHead>
            <TableHead className="w-28">작성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(posts ?? []).map((p: any) => {
            const r = ratingByPost.get(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                <TableCell>
                  <Link href={`/board/${p.id}`} className="hover:underline">
                    {p.is_notice && <Badge className="mr-2">공지</Badge>}
                    {p.title}
                  </Link>
                </TableCell>
                {isWork && (
                  <TableCell><StarDisplay avg={r?.avg ?? 0} count={r?.count ?? 0} /></TableCell>
                )}
                <TableCell>{nameMap.get(p.author_id) ?? "-"}</TableCell>
                <TableCell>{p.created_at?.slice(0, 10)}</TableCell>
              </TableRow>
            );
          })}
          {(posts ?? []).length === 0 && (
            <TableRow><TableCell colSpan={isWork ? 5 : 4} className="text-center text-muted-foreground">등록된 글이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
