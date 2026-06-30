import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { WorkLogActions } from "./worklog-actions";
import { WORKLOG_STATUS_LABEL, type WorkLogStatus } from "@/lib/worklog/types";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<WorkLogStatus, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default async function WorkLogInboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  const [dirRes, logsRes] = await Promise.all([
    supabase.rpc("user_directory"),
    supabase
      .from("work_logs")
      .select("id, log_date, title, content, status, user_id, created_at")
      .eq("approver_id", user.id)
      .order("status")
      .order("created_at", { ascending: false }),
  ]);

  const nameById = new Map(((dirRes.data ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
  const logs = logsRes.data ?? [];
  const pendingCount = logs.filter((l) => l.status === "pending").length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">업무일지 승인함</h1>
        {pendingCount > 0 && <Badge>대기 {pendingCount}건</Badge>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead><TableHead>작성자</TableHead>
            <TableHead>제목/내용</TableHead><TableHead>상태</TableHead><TableHead>처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="align-top">{l.log_date}</TableCell>
              <TableCell className="align-top">{nameById.get(l.user_id) ?? "-"}</TableCell>
              <TableCell>
                {l.title && <div className="font-medium">{l.title}</div>}
                <div className="whitespace-pre-wrap text-sm text-muted-foreground">{l.content}</div>
              </TableCell>
              <TableCell className="align-top">
                <Badge variant={STATUS_VARIANT[l.status as WorkLogStatus]}>{WORKLOG_STATUS_LABEL[l.status as WorkLogStatus]}</Badge>
              </TableCell>
              <TableCell className="align-top">
                {l.status === "pending" ? <WorkLogActions id={l.id} /> : <span className="text-xs text-muted-foreground">처리 완료</span>}
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">승인할 업무일지가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
