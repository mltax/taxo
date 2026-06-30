import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canAdmin, canManageLeave } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // 연차 부여 관리(인사관리자) 또는 대표(admin)만 접근. 그 외 탭은 대표 전용.
  if (!canManageLeave(user.role)) redirect("/dashboard");
  const isAdmin = canAdmin(user.role);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "관리자" : "연차 부여 관리"}</h1>
        <nav className="mt-3 flex flex-wrap gap-4 border-b">
          {isAdmin && (
            <Link href="/admin/teams" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">인사관리</Link>
          )}
          <Link href="/admin/leave" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">연차 관리</Link>
          {isAdmin && (
            <>
              <Link href="/admin/employees" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">직원/계정</Link>
              <Link href="/admin/items" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 항목</Link>
              <Link href="/admin/welfare-stats" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 통계</Link>
            </>
          )}
        </nav>
      </div>
      {children}
    </div>
  );
}
