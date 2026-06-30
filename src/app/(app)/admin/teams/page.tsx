import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { NewTeam, LeaderSelect, TeamSelect, ApproverSelect } from "./team-forms";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function TeamsPage() {
  const me = await requireUser();
  if (!canAdmin(me.role)) redirect("/admin/leave");
  const supabase = await createClient();
  const [teamsRes, usersRes] = await Promise.all([
    supabase.from("teams").select("id, name, leader_id").order("name"),
    supabase.from("users").select("id, name, team_id, approver_id, role").order("name"),
  ]);
  const teams = teamsRes.data ?? [];
  const users = usersRes.data ?? [];
  const people = users.map((u) => ({ id: u.id, name: u.name }));
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>팀 관리</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <NewTeam />
          <Table>
            <TableHeader><TableRow><TableHead>팀</TableHead><TableHead>팀장</TableHead></TableRow></TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell><LeaderSelect teamId={t.id} leaderId={t.leader_id} people={people} /></TableCell>
                </TableRow>
              ))}
              {teams.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground">팀이 없습니다.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">직원 배정</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>이름</TableHead><TableHead>팀</TableHead><TableHead>직속 결재자</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell><TeamSelect userId={u.id} teamId={u.team_id} teams={teams} /></TableCell>
                <TableCell>
                  <ApproverSelect userId={u.id} approverId={u.approver_id} people={people} />
                  {u.approver_id && <span className="ml-2 text-xs text-muted-foreground">→ {nameById.get(u.approver_id) ?? ""}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
