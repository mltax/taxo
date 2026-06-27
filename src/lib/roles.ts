export type Role = "staff" | "approver" | "hr_manager" | "admin";

export interface NavItem {
  label: string;
  href: string;
}

export function canApprove(role: Role): boolean {
  return role === "approver" || role === "hr_manager" || role === "admin";
}

export function canManageHR(role: Role): boolean {
  return role === "hr_manager" || role === "admin";
}

export function canAdmin(role: Role): boolean {
  return role === "admin";
}

export function navItemsForRole(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "복지 청구", href: "/welfare" },
    { label: "자료실", href: "/board" },
    { label: "연차", href: "/leave" },
  ];
  if (canApprove(role)) {
    items.push({ label: "승인 대기함", href: "/welfare/inbox" });
    items.push({ label: "연차 승인함", href: "/leave/inbox" });
  }
  if (canManageHR(role)) {
    items.push({ label: "인사", href: "/admin/teams" });
  }
  if (canAdmin(role)) {
    items.push({ label: "관리자", href: "/admin/employees" });
  }
  return items;
}
