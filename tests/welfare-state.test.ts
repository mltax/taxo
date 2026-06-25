import { describe, it, expect } from "vitest";
import { nextStatus, type ClaimStatus, type ClaimAction } from "@/lib/welfare/state";

describe("welfare claim state machine", () => {
  it("approve: pending -> approved", () => {
    expect(nextStatus("pending", "approve")).toBe("approved");
  });
  it("reject: pending -> rejected", () => {
    expect(nextStatus("pending", "reject")).toBe("rejected");
  });
  it("pay: approved -> paid", () => {
    expect(nextStatus("approved", "pay")).toBe("paid");
  });
  it("cannot approve an already approved claim", () => {
    expect(() => nextStatus("approved", "approve")).toThrow();
  });
  it("cannot pay a pending claim", () => {
    expect(() => nextStatus("pending", "pay")).toThrow();
  });
  it("cannot act on a paid claim", () => {
    const actions: ClaimAction[] = ["approve", "reject", "pay"];
    for (const a of actions) {
      expect(() => nextStatus("paid", a)).toThrow();
    }
  });
});
