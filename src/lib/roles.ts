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

/** 연차 부여 관리 권한: 인사관리자 + 대표 */
export function canManageLeave(role: Role): boolean {
  return role === "hr_manager" || role === "admin";
}

/** 캘린더 일정(사내 회의·외부교육·세미나 등) 관리 권한: 인사관리자 + 대표 */
export function canManageEvents(role: Role): boolean {
  return role === "hr_manager" || role === "admin";
}

export type BoardType = "free" | "work";

/** 글 수정 권한: 자유게시판=글쓴이, 업무공유게시판=관리자만 */
export function canEditPost(role: Role, board: BoardType, isAuthor: boolean): boolean {
  if (board === "work") return role === "admin";
  return isAuthor;
}

/** 글 삭제 권한: 자유게시판=글쓴이 또는 관리자, 업무공유게시판=관리자만 */
export function canDeletePost(role: Role, board: BoardType, isAuthor: boolean): boolean {
  if (board === "work") return role === "admin";
  return isAuthor || role === "admin";
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
  if (canManageLeave(role)) {
    leaveChildren.push({ label: "연차 부여 관리", href: "/admin/leave" });
    leaveChildren.push({ label: "연차 사용 내역", href: "/admin/leave-status" });
  }

  // 업무일지 그룹
  const worklogChildren: NavItem[] = [{ label: "업무일지 작성", href: "/worklog" }];
  if (canApprove(role)) {
    worklogChildren.push({ label: "업무일지 승인함", href: "/worklog/inbox" });
  }

  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "세무 챗봇", href: "/chatbot" },
    { label: "한영복지신청", children: welfareChildren },
    {
      label: "게시판",
      children: [
        { label: "자유게시판", href: "/board/free" },
        { label: "업무공유게시판", href: "/board/work" },
      ],
    },
    { label: "연차 관리", children: leaveChildren },
    { label: "업무일지", children: worklogChildren },
  ];
  if (canAdmin(role)) {
    // 관리자(인사·연차·계정·복지항목) 영역은 대표(admin) 전용
    items.push({ label: "관리자", href: "/admin/teams" });
  }
  return items;
}
