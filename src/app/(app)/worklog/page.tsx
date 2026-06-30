import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WorkLogForm } from "./worklog-form";
import { WORKLOG_STATUS_LABEL, type WorkLogStatus } from "@/lib/worklog/types";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<WorkLogStatus, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default async function WorkLogPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [dirRes, meRes, logsRes] = await Promise.all([
    supabase.rpc("user_directory"),
    supabase.from("users").select("approver_id").eq("id", user.id).single(),
    supabase
      .from("work_logs")
      .select("id, log_date, title, content, status, reject_reason, approver_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const directory = (dirRes.data ?? []) as { id: string; name: string; role: string }[];
  const approvers = directory.filter(
    (u) => ["approver", "hr_manager", "admin"].includes(u.role) && u.id !== user.id
  );
  const nameById = new Map(directory.map((u) => [u.id, u.name]));
  const defaultApproverId = meRes.data?.approver_id ?? "";
  const logs = logsRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">업무일지 작성</h1>
        <Card>
          <CardHeader><CardTitle>새 업무일지</CardTitle></CardHeader>
          <CardContent>
            <WorkLogForm approvers={approvers} defaultApproverId={defaultApproverId} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 업무일지</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead><TableHead>제목/내용</TableHead>
              <TableHead>결재자</TableHead><TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="align-top">{l.log_date}</TableCell>
                <TableCell>
                  {l.title && <div className="font-medium">{l.title}</div>}
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">{l.content}</div>
                  {l.status === "rejected" && l.reject_reason && (
                    <div className="mt-1 text-xs text-destructive">반려: {l.reject_reason}</div>
                  )}
                </TableCell>
                <TableCell className="align-top">{nameById.get(l.approver_id) ?? "-"}</TableCell>
                <TableCell className="align-top">
                  <Badge variant={STATUS_VARIANT[l.status as WorkLogStatus]}>{WORKLOG_STATUS_LABEL[l.status as WorkLogStatus]}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">작성한 업무일지가 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
