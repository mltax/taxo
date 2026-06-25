import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // 내 신청 상태별 건수
  const { data: myClaims } = await supabase
    .from("welfare_claims")
    .select("status")
    .eq("user_id", user.id);
  const myPending = (myClaims ?? []).filter((c) => c.status === "pending").length;

  // 결재자: 승인 대기 건수
  let inboxCount = 0;
  if (canApprove(user.role)) {
    const { count } = await supabase
      .from("welfare_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    inboxCount = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">홈</h1>
        <p className="text-muted-foreground">{user.name} 님, 환영합니다.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/welfare">
          <Card className="transition hover:bg-muted/50">
            <CardHeader><CardTitle className="text-base">내 승인 대기</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{myPending}건</CardContent>
          </Card>
        </Link>
        {canApprove(user.role) && (
          <Link href="/welfare/inbox">
            <Card className="transition hover:bg-muted/50">
              <CardHeader><CardTitle className="text-base">결재 대기함</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{inboxCount}건</CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
