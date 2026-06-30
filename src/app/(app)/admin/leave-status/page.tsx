import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageLeave } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeaveStatusPage() {
  const me = await requireUser();
  if (!canManageLeave(me.role)) redirect("/dashboard");
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const yearStr = String(year);

  const [usersRes, grantsRes, reqRes] = await Promise.all([
    supabase.from("users").select("id, name").order("name"),
    supabase.from("leave_grants").select("user_id, granted_days").eq("year", year),
    supabase
      .from("leave_requests")
      .select("user_id, days, status, start_date"),
  ]);

  const users = usersRes.data ?? [];
  const grantByUser = new Map(
    (grantsRes.data ?? []).map((g) => [g.user_id, Number(g.granted_days)])
  );

  // 사용(승인) · 대기(pending) 일수 집계 — 해당 연도 시작일 기준
  const usedByUser = new Map<string, number>();
  const pendingByUser = new Map<string, number>();
  for (const r of reqRes.data ?? []) {
    if (!r.start_date?.startsWith(yearStr)) continue;
    if (r.status === "approved") {
      usedByUser.set(r.user_id, (usedByUser.get(r.user_id) ?? 0) + Number(r.days));
    } else if (r.status === "pending") {
      pendingByUser.set(r.user_id, (pendingByUser.get(r.user_id) ?? 0) + Number(r.days));
    }
  }

  const rows = users.map((u) => {
    const granted = grantByUser.get(u.id) ?? 0;
    const used = usedByUser.get(u.id) ?? 0;
    const pending = pendingByUser.get(u.id) ?? 0;
    return { id: u.id, name: u.name, granted, used, pending, remaining: granted - used };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">연차 사용 내역 ({year}년)</h2>
      <p className="text-sm text-muted-foreground">
        전 직원의 부여·사용·잔여 연차 현황입니다. 사용은 승인된 연차 기준이며, 대기는 승인 대기 중인 신청입니다.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead className="text-right">부여</TableHead>
            <TableHead className="text-right">사용</TableHead>
            <TableHead className="text-right">대기</TableHead>
            <TableHead className="text-right">잔여</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">{r.granted}일</TableCell>
              <TableCell className="text-right">{r.used}일</TableCell>
              <TableCell className="text-right text-muted-foreground">{r.pending}일</TableCell>
              <TableCell className={`text-right font-semibold ${r.remaining < 0 ? "text-destructive" : "text-primary"}`}>
                {r.remaining}일
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">직원이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
