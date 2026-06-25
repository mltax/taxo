export type Role = "staff" | "approver" | "admin";

export interface NavItem {
  label: string;
  href: string;
}

export function canApprove(role: Role): boolean {
  return role === "approver" || role === "admin";
}

export function canAdmin(role: Role): boolean {
  return role === "admin";
}

export function navItemsForRole(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "복지 청구", href: "/welfare" },
    { label: "자료실", href: "/board" },
  ];
  if (canApprove(role)) {
    items.push({ label: "승인 대기함", href: "/welfare/inbox" });
  }
  if (canAdmin(role)) {
    items.push({ label: "관리자", href: "/admin" });
  }
  return items;
}
