import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { LeaveActions } from "./leave-actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeaveInboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, days, half_day, reason, users:user_id(name)")
    .eq("approver_id", user.id)
    .eq("status", "pending")
    .order("created_at");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">연차 승인함</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>신청자</TableHead><TableHead>기간</TableHead>
            <TableHead>일수</TableHead><TableHead>사유</TableHead><TableHead>처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(pending ?? []).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell>{r.users?.name ?? "-"}</TableCell>
              <TableCell>
                {r.start_date}{!r.half_day && r.end_date !== r.start_date ? ` ~ ${r.end_date}` : ""}
                {r.half_day ? " (반차)" : ""}
              </TableCell>
              <TableCell>{Number(r.days)}일</TableCell>
              <TableCell>{r.reason}</TableCell>
              <TableCell><LeaveActions id={r.id} /></TableCell>
            </TableRow>
          ))}
          {(pending ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">대기 중인 신청이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
