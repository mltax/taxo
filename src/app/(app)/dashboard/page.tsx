import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { RocketLogo } from "@/components/rocket-logo";
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

  // 최근 공지 (상위 5개)
  const { data: notices } = await supabase
    .from("posts")
    .select("id, title, created_at")
    .eq("is_notice", true)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="bg-cosmic relative overflow-hidden rounded-2xl px-6 py-7 text-white shadow-lg">
        <div className="bg-stars pointer-events-none absolute inset-0 opacity-70" />
        <RocketLogo className="animate-float absolute right-6 top-1/2 hidden h-16 w-16 -translate-y-1/2 opacity-90 drop-shadow-[0_0_18px_rgba(167,139,250,0.6)] sm:block" />
        <div className="relative">
          <h1 className="text-2xl font-bold">안녕하세요, {user.name} 님 🚀</h1>
          <p className="mt-1 text-violet-100">세무법인 한영(창원) 사내 시스템에 오신 것을 환영합니다.</p>
        </div>
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
      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 공지</h2>
        <div className="divide-y rounded-md border">
          {(notices ?? []).map((n) => (
            <Link key={n.id} href={`/board/${n.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
              <span className="text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.created_at?.slice(0, 10)}</span>
            </Link>
          ))}
          {(notices ?? []).length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">공지가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
