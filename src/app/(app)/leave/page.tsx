import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveForm } from "./leave-form";
import { WithdrawLeaveButton } from "./withdraw-button";
import { LEAVE_STATUS_LABEL, type LeaveStatus } from "@/lib/leave/types";
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
      .select("id, start_date, end_date, days, half_day, status, reason, reject_reason, created_at")
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
          <Card><CardHeader><CardTitle className="text-sm">{year}년 부여</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{granted}일</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">사용</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{used}일</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">잔여</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{remaining}일</CardContent></Card>
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
              <TableHead>기간</TableHead><TableHead>일수</TableHead>
              <TableHead>사유</TableHead><TableHead>상태</TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
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
                <TableCell><Badge variant={r.status === "rejected" ? "destructive" : r.status === "approved" ? "default" : "secondary"}>{LEAVE_STATUS_LABEL[r.status as LeaveStatus]}</Badge></TableCell>
                <TableCell>
                  {r.status === "pending" && <WithdrawLeaveButton id={r.id} />}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
