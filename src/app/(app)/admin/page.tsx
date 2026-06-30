import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";

export default async function AdminHome() {
  const me = await requireUser();
  redirect(canAdmin(me.role) ? "/admin/employees" : "/admin/leave");
}
