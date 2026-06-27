"use client";

import { useState } from "react";
import {
  createTeam, setTeamLeader, assignEmployeeTeam, setApprover,
} from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Person { id: string; name: string }
interface TeamOpt { id: string; name: string }

export function NewTeam() {
  const [busy, setBusy] = useState(false);
  return (
    <form action={async (fd) => { setBusy(true); await createTeam(fd); setBusy(false); }} className="flex items-end gap-2">
      <Input name="name" placeholder="팀 이름" required className="max-w-xs" />
      <Button type="submit" disabled={busy}>팀 추가</Button>
    </form>
  );
}

export function LeaderSelect({ teamId, leaderId, people }: { teamId: string; leaderId: string | null; people: Person[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={leaderId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await setTeamLeader(teamId, e.target.value || null); setBusy(false); }}>
      <option value="">(미지정)</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function TeamSelect({ userId, teamId, teams }: { userId: string; teamId: string | null; teams: TeamOpt[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={teamId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await assignEmployeeTeam(userId, e.target.value || null); setBusy(false); }}>
      <option value="">(없음)</option>
      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

export function ApproverSelect({ userId, approverId, people }: { userId: string; approverId: string | null; people: Person[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={approverId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await setApprover(userId, e.target.value || null); setBusy(false); }}>
      <option value="">(미지정)</option>
      {people.filter((p) => p.id !== userId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
