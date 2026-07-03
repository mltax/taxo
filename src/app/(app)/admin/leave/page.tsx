import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageLeave } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { GenerateButton, HireDateInput, GrantInput } from "./leave-admin";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeaveAdminPage() {
  const me = await requireUser();
  if (!canManageLeave(me.role)) redirect("/dashboard");
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [usersRes, grantsRes] = await Promise.all([
    supabase.from("users").select("id, name, hire_date").order("name"),
    supabase.from("leave_grants").select("user_id, granted_days").eq("year", year),
  ]);
  const users = usersRes.data ?? [];
  const grantByUser = new Map((grantsRes.data ?? []).map((g) => [g.user_id, Number(g.granted_days)]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">연차 관리 ({year}년)</h2>
        <GenerateButton year={year} />
      </div>
      <p className="text-sm text-muted-foreground">입사일을 입력한 뒤 &quot;일괄 산정&quot;을 누르면 한국법 기준으로 자동 부여됩니다. 부여일수는 개별 수정 가능합니다.</p>
      <Table>
        <TableHeader>
          <TableRow><TableHead>이름</TableHead><TableHead>입사일</TableHead><TableHead>{year}년 부여일수</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell><HireDateInput userId={u.id} hireDate={u.hire_date} /></TableCell>
              <TableCell><GrantInput userId={u.id} year={year} days={grantByUser.get(u.id) ?? 0} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
