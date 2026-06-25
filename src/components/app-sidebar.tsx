import Link from "next/link";
import { navItemsForRole, type Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppSidebar({ name, role }: { name: string; role: Role }) {
  const items = navItemsForRole(role);
  return (
    <aside className="flex w-56 flex-col border-r bg-background p-4">
      <div className="mb-1 text-lg font-semibold">세무사무소</div>
      <div className="mb-4 text-sm text-muted-foreground">
        {name} 님 ({role})
      </div>
      <Separator className="mb-4" />
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" className="w-full">
          로그아웃
        </Button>
      </form>
    </aside>
  );
}
