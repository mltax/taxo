export type Role = "staff" | "approver" | "hr_manager" | "admin";

export interface NavItem {
  label: string;
  href?: string;        // 잎(leaf) 항목: 링크
  children?: NavItem[]; // 그룹: 펼침/접힘
}

export function canApprove(role: Role): boolean {
  return role === "approver" || role === "hr_manager" || role === "admin";
}

export function canAdmin(role: Role): boolean {
  return role === "admin";
}

export function navItemsForRole(role: Role): NavItem[] {
  // 연차 관리 그룹 (클릭 시 펼쳐지는 하위 항목)
  const leaveChildren: NavItem[] = [{ label: "연차 신청", href: "/leave" }];
  if (canApprove(role)) {
    leaveChildren.push({ label: "연차 승인함", href: "/leave/inbox" });
  }

  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "복지 청구", href: "/welfare" },
    { label: "자료실", href: "/board" },
    { label: "연차 관리", children: leaveChildren },
  ];
  if (canApprove(role)) {
    items.push({ label: "승인 대기함", href: "/welfare/inbox" });
  }
  if (canAdmin(role)) {
    // 인사·관리자 영역은 대표(admin) 전용
    items.push({ label: "인사", href: "/admin/teams" });
    items.push({ label: "관리자", href: "/admin/employees" });
  }
  return items;
}
