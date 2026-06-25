import { requireUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <AppSidebar name={user.name} role={user.role} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
