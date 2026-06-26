import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "./item-form";
import { ItemToggle } from "./item-toggle";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function ItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("welfare_items")
    .select("id, name, monthly_limit, is_active")
    .order("created_at");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>복지 항목 추가</CardTitle></CardHeader>
        <CardContent><ItemForm /></CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">복지 항목 목록</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>항목명</TableHead><TableHead>월 한도</TableHead>
              <TableHead>상태</TableHead><TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.name}</TableCell>
                <TableCell>{it.monthly_limit ? `${it.monthly_limit.toLocaleString()}원` : "무제한"}</TableCell>
                <TableCell>
                  {it.is_active ? <Badge>활성</Badge> : <Badge variant="destructive">비활성</Badge>}
                </TableCell>
                <TableCell><ItemToggle itemId={it.id} isActive={it.is_active} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
