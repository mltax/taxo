import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ClaimRow {
  person: string;
  item: string;
  amount: number;
  status: string;
  date: string;
}

export default async function WelfareStatsPage() {
  const me = await requireUser();
  if (!canAdmin(me.role)) redirect("/admin/leave");
  const supabase = await createClient();
  const { data } = await supabase
    .from("welfare_claims")
    .select("amount, status, created_at, users:user_id(name), welfare_items:item_id(name)")
    .in("status", ["approved", "paid"]);

  const rows: ClaimRow[] = (data ?? []).map((c: any) => ({
    person: c.users?.name ?? "-",
    item: c.welfare_items?.name ?? "-",
    amount: Number(c.amount),
    status: c.status,
    date: c.created_at?.slice(0, 10) ?? "",
  }));

  // 인별 × 항목별 집계
  const byPerson = new Map<string, Map<string, { count: number; sum: number }>>();
  for (const r of rows) {
    if (!byPerson.has(r.person)) byPerson.set(r.person, new Map());
    const items = byPerson.get(r.person)!;
    const e = items.get(r.item) ?? { count: 0, sum: 0 };
    e.count += 1;
    e.sum += r.amount;
    items.set(r.item, e);
  }
  const people = [...byPerson.keys()].sort();
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  const detail = [...rows].sort(
    (a, b) => a.person.localeCompare(b.person) || b.date.localeCompare(a.date)
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">인별·항목별 합계 (승인·지급 기준)</h2>
          <Badge variant="outline">총 {grandTotal.toLocaleString()}원</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead><TableHead>항목</TableHead>
              <TableHead className="text-right">건수</TableHead>
              <TableHead className="text-right">금액 합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => {
              const items = byPerson.get(person)!;
              const itemNames = [...items.keys()].sort();
              const personCount = [...items.values()].reduce((s, e) => s + e.count, 0);
              const personSum = [...items.values()].reduce((s, e) => s + e.sum, 0);
              return itemNames
                .map((item, idx) => {
                  const e = items.get(item)!;
                  return (
                    <TableRow key={`${person}-${item}`}>
                      <TableCell>{idx === 0 ? <span className="font-medium">{person}</span> : ""}</TableCell>
                      <TableCell>{item}</TableCell>
                      <TableCell className="text-right">{e.count}건</TableCell>
                      <TableCell className="text-right">{e.sum.toLocaleString()}원</TableCell>
                    </TableRow>
                  );
                })
                .concat(
                  <TableRow key={`${person}-subtotal`} className="bg-muted/40">
                    <TableCell></TableCell>
                    <TableCell className="font-medium">소계</TableCell>
                    <TableCell className="text-right font-medium">{personCount}건</TableCell>
                    <TableCell className="text-right font-medium">{personSum.toLocaleString()}원</TableCell>
                  </TableRow>
                );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">승인된 복지 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">승인 상세 내역 (인별)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead><TableHead>항목</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>상태</TableHead><TableHead>신청일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.person}</TableCell>
                <TableCell>{r.item}</TableCell>
                <TableCell className="text-right">{r.amount.toLocaleString()}원</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status === "paid" ? "지급 완료" : "승인됨"}</Badge></TableCell>
                <TableCell>{r.date}</TableCell>
              </TableRow>
            ))}
            {detail.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
