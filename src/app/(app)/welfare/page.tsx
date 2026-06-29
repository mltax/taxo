import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "./claim-form";
import { WithdrawClaimButton } from "./withdraw-button";
import { getClaimFiles } from "@/lib/welfare/attachments";
import { StatusBadge } from "@/components/status-badge";
import { FileLinks } from "@/components/file-links";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { WelfareItem, WelfareClaim } from "@/lib/welfare/types";

export default async function WelfarePage() {
  const user = await requireUser();
  const supabase = await createClient();

  // 독립 쿼리 병렬 실행
  const [itemsRes, claimsRes] = await Promise.all([
    supabase
      .from("welfare_items")
      .select("id, name, monthly_limit")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("welfare_claims")
      .select("id, item_id, amount, reason, status, created_at, reject_reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const items = itemsRes.data;
  const claims = claimsRes.data ?? [];

  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));
  // 본인 증빙 다운로드
  const filesByClaim = await getClaimFiles(supabase, claims.map((c) => c.id!));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">한영복지신청</h1>
        <Card>
          <CardHeader><CardTitle>새 신청</CardTitle></CardHeader>
          <CardContent>
            <ClaimForm items={(items ?? []) as WelfareItem[]} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 신청 내역</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>항목</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>사유</TableHead>
              <TableHead>증빙</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>신청일</TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((c: Partial<WelfareClaim>) => (
              <TableRow key={c.id}>
                <TableCell>{itemName.get(c.item_id!) ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell>
                  {c.reason}
                  {c.status === "rejected" && c.reject_reason && (
                    <span className="block text-xs text-destructive">반려: {c.reject_reason}</span>
                  )}
                </TableCell>
                <TableCell><FileLinks files={filesByClaim.get(c.id!)} /></TableCell>
                <TableCell><StatusBadge status={c.status!} /></TableCell>
                <TableCell>{c.created_at?.slice(0, 10)}</TableCell>
                <TableCell>
                  {c.status === "pending" && <WithdrawClaimButton id={c.id!} />}
                </TableCell>
              </TableRow>
            ))}
            {claims.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
