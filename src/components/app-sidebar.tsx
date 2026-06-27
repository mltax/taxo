import Link from "next/link";
import { navItemsForRole, type Role } from "@/lib/roles";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<Role, string> = {
  staff: "직원",
  approver: "결재자",
  hr_manager: "인사관리자",
  admin: "관리자",
};

export function AppSidebar({ name, role }: { name: string; role: Role }) {
  const items = navItemsForRole(role);
  return (
    <aside className="flex w-60 flex-col border-r bg-sidebar">
      {/* 코스믹 헤더 */}
      <div className="bg-cosmic relative overflow-hidden px-4 py-5">
        <div className="bg-stars pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-white shadow ring-1 ring-white/20">
            <BrandLogo className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">세무법인 한영</div>
            <div className="text-xs text-violet-200">창원 · 사내 시스템</div>
          </div>
        </div>
        <div className="relative mt-3 text-xs text-violet-100/90">
          {name} 님 · {ROLE_LABEL[role]}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" className="w-full">
            로그아웃
          </Button>
        </form>
      </div>
    </aside>
  );
}
