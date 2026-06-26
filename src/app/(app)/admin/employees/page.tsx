import { createClient } from "@/lib/supabase/server";
import { NewEmployee } from "./new-employee";
import { RoleSelect, ActiveToggle } from "./employee-row";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/roles";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, department, is_active")
    .order("created_at");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>새 직원 계정 발급</CardTitle></CardHeader>
        <CardContent><NewEmployee /></CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">직원 목록</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead><TableHead>이메일</TableHead>
              <TableHead>소속</TableHead><TableHead>역할</TableHead>
              <TableHead>상태</TableHead><TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.department ?? "-"}</TableCell>
                <TableCell><RoleSelect userId={u.id} role={u.role as Role} /></TableCell>
                <TableCell>
                  {u.is_active ? <Badge>활성</Badge> : <Badge variant="destructive">비활성</Badge>}
                </TableCell>
                <TableCell><ActiveToggle userId={u.id} isActive={u.is_active} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
