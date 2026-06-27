import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, category, is_notice, created_at, users:author_id(name)")
    .eq("board_type", boardType)
    .order("is_notice", { ascending: false })
    .order("created_at", { ascending: false });

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
            <TableHead className="w-28">작성자</TableHead>
            <TableHead className="w-28">작성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(posts ?? []).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
              <TableCell>
                <Link href={`/board/${p.id}`} className="hover:underline">
                  {p.is_notice && <Badge className="mr-2">공지</Badge>}
                  {p.title}
                </Link>
              </TableCell>
              <TableCell>{p.users?.name ?? "-"}</TableCell>
              <TableCell>{p.created_at?.slice(0, 10)}</TableCell>
            </TableRow>
          ))}
          {(posts ?? []).length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">등록된 글이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
