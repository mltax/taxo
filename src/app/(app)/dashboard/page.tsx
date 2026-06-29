import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isApprover = canApprove(user.role);

  // 독립 쿼리들을 병렬 실행 (네트워크 왕복 한 번으로 묶음)
  const year = new Date().getFullYear();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [myClaimsRes, inboxRes, noticesRes, grantRes, leaveUsedRes, myPostsRes, ledgerRes] = await Promise.all([
    supabase.from("welfare_claims").select("status").eq("user_id", user.id),
    isApprover
      ? supabase
          .from("welfare_claims")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("posts")
      .select("id, title, created_at, users:author_id(name)")
      .eq("is_notice", true)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("leave_grants").select("granted_days").eq("user_id", user.id).eq("year", year).maybeSingle(),
    supabase.from("leave_requests").select("days, start_date").eq("user_id", user.id).eq("status", "approved"),
    supabase
      .from("posts")
      .select("id, title, board_type, reward_points, reward_points_at, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("point_ledger").select("points").eq("user_id", user.id),
  ]);

  const myPending = (myClaimsRes.data ?? []).filter((c) => c.status === "pending").length;
  const inboxCount = inboxRes.count ?? 0;
  const notices = noticesRes.data;
  const granted = Number(grantRes.data?.granted_days ?? 0);
  const usedLeave = (leaveUsedRes.data ?? [])
    .filter((r) => r.start_date.startsWith(String(year)))
    .reduce((s, r) => s + Number(r.days), 0);
  const remainingLeave = granted - usedLeave;

  // 내 포인트 (포상 포인트 = 내 글에 부여된 포인트 + 삭제된 글의 적립분)
  const myPosts = myPostsRes.data ?? [];
  const ledgerTotal = (ledgerRes.data ?? []).reduce((s, l) => s + (l.points ?? 0), 0);
  const earnedTotal =
    myPosts.reduce((s, p) => s + (p.reward_points ?? 0), 0) + ledgerTotal;
  const earnedThisMonth = myPosts
    .filter((p) => p.reward_points && p.reward_points_at && p.reward_points_at >= monthStart)
    .reduce((s, p) => s + (p.reward_points ?? 0), 0);
  const usedPoints = 0; // 향후 복지신청 차감 시 연동
  const boardName = (t: string) => (t === "free" ? "자유게시판" : "업무공유게시판");

  return (
    <div className="space-y-6">
      <div className="bg-cosmic relative overflow-hidden rounded-2xl px-6 py-7 text-white shadow-lg">
        <div className="bg-stars pointer-events-none absolute inset-0 opacity-70" />
        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 place-items-center rounded-2xl bg-white/95 p-3 shadow-lg sm:grid">
          <BrandLogo className="h-12 w-12" />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold">안녕하세요, {user.name} 님</h1>
          <p className="mt-1 text-slate-200">세무법인 한영(창원) 사내 시스템에 오신 것을 환영합니다.</p>
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
        <Link href="/leave">
          <Card className="transition hover:bg-muted/50">
            <CardHeader><CardTitle className="text-base">내 잔여 연차</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{remainingLeave}일</CardContent>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 포인트</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">누적 포인트</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold text-primary">{earnedTotal.toLocaleString()}P</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">사용 포인트</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{usedPoints.toLocaleString()}P</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">이번달 획득</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{earnedThisMonth.toLocaleString()}P</CardContent>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">포상 포인트는 업무공유 글에 부여된 포인트입니다. (사용은 향후 복지신청 연동 예정)</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내가 쓴 글</h2>
        <div className="divide-y rounded-md border">
          {myPosts.slice(0, 8).map((p) => (
            <Link key={p.id} href={`/board/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
              <span className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{boardName(p.board_type)}</Badge>
                <span className="truncate">{p.title}</span>
                {p.reward_points ? <Badge>{p.reward_points.toLocaleString()}P</Badge> : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.created_at?.slice(0, 10)}</span>
            </Link>
          ))}
          {myPosts.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">작성한 글이 없습니다.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 공지</h2>
        <div className="divide-y rounded-md border">
          {(notices ?? []).map((n: any) => (
            <Link key={n.id} href={`/board/${n.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
              <span className="truncate text-sm">{n.title}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span>{n.users?.name ?? "-"}</span>
                <span>·</span>
                <span>{n.created_at?.slice(0, 10)}</span>
              </span>
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
