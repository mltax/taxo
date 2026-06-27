import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { LeaveActions } from "./leave-actions";
import { LEAVE_STATUS_LABEL, type LeaveStatus } from "@/lib/leave/types";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<LeaveStatus, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default async function LeaveInboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  // 내가 결재자인 모든 신청을 상태별로(대기 우선) 한 화면에 표시
  const { data: requests } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, days, half_day, reason, status, reject_reason, users:user_id(name)")
    .eq("approver_id", user.id)
    .order("status")
    .order("created_at", { ascending: false });

  const rows = requests ?? [];
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">연차 승인함</h1>
        {pendingCount > 0 && <Badge>대기 {pendingCount}건</Badge>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>신청자</TableHead><TableHead>기간</TableHead>
            <TableHead>일수</TableHead><TableHead>사유</TableHead>
            <TableHead>상태</TableHead><TableHead>처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell>{r.users?.name ?? "-"}</TableCell>
              <TableCell>
                {r.start_date}{!r.half_day && r.end_date !== r.start_date ? ` ~ ${r.end_date}` : ""}
                {r.half_day ? " (반차)" : ""}
              </TableCell>
              <TableCell>{Number(r.days)}일</TableCell>
              <TableCell>
                {r.reason}
                {r.status === "rejected" && r.reject_reason && (
                  <span className="block text-xs text-destructive">반려: {r.reject_reason}</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status as LeaveStatus]}>
                  {LEAVE_STATUS_LABEL[r.status as LeaveStatus]}
                </Badge>
              </TableCell>
              <TableCell>
                {r.status === "pending" ? (
                  <LeaveActions id={r.id} />
                ) : (
                  <span className="text-xs text-muted-foreground">처리 완료</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
