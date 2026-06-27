import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // 인사·관리자 영역 전체는 대표(admin) 전용
  if (!canAdmin(user.role)) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자</h1>
        <nav className="mt-3 flex flex-wrap gap-4 border-b">
          <Link href="/admin/teams" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">인사관리</Link>
          <Link href="/admin/leave" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">연차 관리</Link>
          <Link href="/admin/employees" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">직원/계정</Link>
          <Link href="/admin/items" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 항목</Link>
          <Link href="/admin/welfare-stats" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 통계</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
