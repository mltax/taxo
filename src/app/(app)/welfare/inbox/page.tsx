import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove, canAdmin } from "@/lib/roles";
import { getNameMap } from "@/lib/users/directory";
import { getClaimFiles } from "@/lib/welfare/attachments";
import { PendingActions, PayAction } from "./claim-actions";
import { StatusBadge } from "@/components/status-badge";
import { FileLinks } from "@/components/file-links";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function InboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  // 대기/승인 목록 + 이름 맵 병렬 조회
  const [pendingRes, approvedRes, nameMap] = await Promise.all([
    supabase
      .from("welfare_claims")
      .select("id, amount, reason, created_at, user_id, welfare_items:item_id(name)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("welfare_claims")
      .select("id, amount, reason, approved_at, user_id, welfare_items:item_id(name)")
      .eq("status", "approved")
      .order("approved_at"),
    getNameMap(supabase),
  ]);
  const pending = pendingRes.data ?? [];
  const approved = approvedRes.data ?? [];

  // 증빙 첨부(서명 URL) — 결재자가 확인·다운로드
  const filesByClaim = await getClaimFiles(
    supabase,
    [...pending, ...approved].map((c) => c.id)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">승인 대기함</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>신청자</TableHead><TableHead>항목</TableHead>
              <TableHead>금액</TableHead><TableHead>사유</TableHead>
              <TableHead>증빙</TableHead>
              <TableHead>신청일</TableHead><TableHead>처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{nameMap.get(c.user_id) ?? "-"}</TableCell>
                <TableCell>{c.welfare_items?.name ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell>{c.reason}</TableCell>
                <TableCell><FileLinks files={filesByClaim.get(c.id)} /></TableCell>
                <TableCell>{c.created_at?.slice(0, 10)}</TableCell>
                <TableCell><PendingActions claimId={c.id} /></TableCell>
              </TableRow>
            ))}
            {pending.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">대기 중인 신청이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">승인됨 (지급 대기)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>신청자</TableHead><TableHead>항목</TableHead>
              <TableHead>금액</TableHead><TableHead>증빙</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>{canAdmin(user.role) ? "지급" : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approved.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{nameMap.get(c.user_id) ?? "-"}</TableCell>
                <TableCell>{c.welfare_items?.name ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell><FileLinks files={filesByClaim.get(c.id)} /></TableCell>
                <TableCell><StatusBadge status="approved" /></TableCell>
                <TableCell>{canAdmin(user.role) ? <PayAction claimId={c.id} /> : null}</TableCell>
              </TableRow>
            ))}
            {approved.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">승인된 신청이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
