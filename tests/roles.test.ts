import { describe, it, expect } from "vitest";
import { canApprove, canAdmin, canManageHR, navItemsForRole, type Role } from "@/lib/roles";

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

  it("staff sees base nav without 승인함/관리자", () => {
    const labels = navItemsForRole("staff").map((i) => i.label);
    expect(labels).toContain("홈");
    expect(labels).toContain("복지 청구");
    expect(labels).not.toContain("승인 대기함");
    expect(labels).not.toContain("관리자");
  });

  it("approver sees 승인 대기함 but not 관리자", () => {
    const labels = navItemsForRole("approver").map((i) => i.label);
    expect(labels).toContain("승인 대기함");
    expect(labels).not.toContain("관리자");
  });

  it("admin sees 관리자", () => {
    const labels = navItemsForRole("admin").map((i) => i.label);
    expect(labels).toContain("관리자");
  });

  it("hr_manager and admin can manage HR; others cannot", () => {
    expect(canManageHR("staff")).toBe(false);
    expect(canManageHR("approver")).toBe(false);
    expect(canManageHR("hr_manager")).toBe(true);
    expect(canManageHR("admin")).toBe(true);
  });

  it("hr_manager can approve", () => {
    expect(canApprove("hr_manager")).toBe(true);
  });

  it("staff sees 연차 but not 연차 승인함/인사", () => {
    const labels = navItemsForRole("staff").map((i) => i.label);
    expect(labels).toContain("연차");
    expect(labels).not.toContain("연차 승인함");
    expect(labels).not.toContain("인사");
  });

  it("approver sees 연차 승인함 but not 인사", () => {
    const labels = navItemsForRole("approver").map((i) => i.label);
    expect(labels).toContain("연차 승인함");
    expect(labels).not.toContain("인사");
  });

  it("hr_manager sees 인사", () => {
    expect(navItemsForRole("hr_manager").map((i) => i.label)).toContain("인사");
  });
});
