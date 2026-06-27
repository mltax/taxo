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
  // 한영복지신청 그룹
  const welfareChildren: NavItem[] = [{ label: "복지신청", href: "/welfare" }];
  if (canApprove(role)) {
    welfareChildren.push({ label: "승인 대기함", href: "/welfare/inbox" });
  }

  // 연차 관리 그룹
  const leaveChildren: NavItem[] = [{ label: "연차 신청", href: "/leave" }];
  if (canApprove(role)) {
    leaveChildren.push({ label: "연차 승인함", href: "/leave/inbox" });
  }

  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "한영복지신청", children: welfareChildren },
    { label: "자료실", href: "/board" },
    { label: "연차 관리", children: leaveChildren },
  ];
  if (canAdmin(role)) {
    // 관리자(인사·연차·계정·복지항목) 영역은 대표(admin) 전용
    items.push({ label: "관리자", href: "/admin/teams" });
  }
  return items;
}
