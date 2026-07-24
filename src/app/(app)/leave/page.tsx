import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveForm } from "./leave-form";
import { WithdrawLeaveButton } from "./withdraw-button";
import {
  LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL,
  type LeaveStatus, type LeaveType,
} from "@/lib/leave/types";
import { formatDays, formatDateKo } from "@/lib/leave/calc";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeavePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [grantRes, reqRes] = await Promise.all([
    supabase
      .from("leave_grants")
      .select("granted_days")
      .eq("user_id", user.id)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, days, half_day, leave_type, status, reason, reject_reason, created_at, stage, next_approver_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const granted = grantRes.data?.granted_days ?? 0;
  const requests = reqRes.data ?? [];
  const used = requests
    .filter((r) => r.status === "approved" && r.start_date.startsWith(String(year)))
    .reduce((sum, r) => sum + Number(r.days), 0);
  const remaining = Number(granted) - used;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">연차</h1>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">{year}년 부여</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatDays(granted)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">사용</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatDays(used)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">잔여</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{formatDays(remaining)}</CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>연차 신청</CardTitle></CardHeader>
          <CardContent><LeaveForm /></CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 신청 내역</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>기간</TableHead><TableHead>종류</TableHead><TableHead>일수</TableHead>
              <TableHead>사유</TableHead><TableHead>상태</TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {formatDateKo(r.start_date)}{r.leave_type === "full" && r.end_date !== r.start_date ? ` ~ ${formatDateKo(r.end_date)}` : ""}
                </TableCell>
                <TableCell>{LEAVE_TYPE_LABEL[r.leave_type as LeaveType]}</TableCell>
                <TableCell>{formatDays(Number(r.days))}</TableCell>
                <TableCell>
                  {r.reason}
                  {r.status === "rejected" && r.reject_reason && (
                    <span className="block text-xs text-destructive">반려: {r.reject_reason}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "rejected" ? "destructive" : r.status === "approved" ? "default" : "secondary"}>{LEAVE_STATUS_LABEL[r.status as LeaveStatus]}</Badge>
                  {r.status === "pending" && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {r.stage === 2 ? "1차 승인 · 인사관리자 대기" : r.next_approver_id ? "팀장 결재 대기" : "결재 대기"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.status === "pending" && <WithdrawLeaveButton id={r.id} />}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
