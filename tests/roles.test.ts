import { describe, it, expect } from "vitest";
import { canApprove, canAdmin, navItemsForRole, type Role, type NavItem } from "@/lib/roles";

/** 최상위 + 하위 항목 라벨을 모두 평탄화 */
function allLabels(role: Role): string[] {
  return navItemsForRole(role).flatMap((i: NavItem) => [
    i.label,
    ...(i.children ?? []).map((c) => c.label),
  ]);
}

describe("roles", () => {
  it("approver and admin can approve, staff cannot", () => {
    expect(canApprove("staff")).toBe(false);
    expect(canApprove("approver")).toBe(true);
    expect(canApprove("admin")).toBe(true);
  });

  it("only admin can access admin area", () => {
    expect(canAdmin("staff")).toBe(false);
    expect(canAdmin("approver")).toBe(false);
    expect(canAdmin("admin")).toBe(true);
  });

  it("staff sees 한영복지신청 group with 복지신청, no 승인함/관리자", () => {
    const top = navItemsForRole("staff").map((i) => i.label);
    expect(top).toContain("홈");
    expect(top).toContain("한영복지신청");
    expect(allLabels("staff")).toContain("복지신청");
    expect(allLabels("staff")).not.toContain("승인 대기함");
    expect(top).not.toContain("관리자");
  });

  it("approver sees 승인 대기함 under 한영복지신청 but not 관리자", () => {
    const welfareGroup = navItemsForRole("approver").find((i) => i.label === "한영복지신청");
    expect(welfareGroup?.children?.map((c) => c.label)).toContain("승인 대기함");
    expect(navItemsForRole("approver").map((i) => i.label)).not.toContain("관리자");
  });

  it("admin sees 관리자 but not separate 인사 item", () => {
    const labels = navItemsForRole("admin").map((i) => i.label);
    expect(labels).toContain("관리자");
    expect(labels).not.toContain("인사");
  });

  it("hr_manager can approve", () => {
    expect(canApprove("hr_manager")).toBe(true);
  });

  it("연차 관리 그룹과 연차 신청 하위가 모두에게 보인다", () => {
    const top = navItemsForRole("staff").map((i) => i.label);
    expect(top).toContain("연차 관리");
    expect(allLabels("staff")).toContain("연차 신청");
  });

  it("staff는 연차 승인함/인사가 없다", () => {
    const labels = allLabels("staff");
    expect(labels).not.toContain("연차 승인함");
    expect(labels).not.toContain("인사");
  });

  it("approver는 연차 승인함이 연차 관리 하위에 있고 인사는 없다", () => {
    const leaveGroup = navItemsForRole("approver").find((i) => i.label === "연차 관리");
    expect(leaveGroup?.children?.map((c) => c.label)).toContain("연차 승인함");
    expect(allLabels("approver")).not.toContain("인사");
  });

  it("hr_manager does NOT see 인사 (HR is admin-only)", () => {
    const labels = navItemsForRole("hr_manager").map((i) => i.label);
    expect(labels).not.toContain("인사");
    expect(labels).not.toContain("관리자");
  });
});
