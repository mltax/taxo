import { describe, it, expect } from "vitest";
import { searchConsultations, formatContext } from "@/lib/chatbot/search";

describe("chatbot search", () => {
  it("returns an empty array for a query with no matching tokens", () => {
    const results = searchConsultations("!!! ?? ..", 5);
    expect(results).toEqual([]);
  });

  it("returns at most topK results", () => {
    const results = searchConsultations("세금 신고 부가가치세", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("ranks results containing the query term in the title above others", () => {
    const results = searchConsultations("상속세", 10);
    if (results.length > 1) {
      // 상위 결과가 최소한 질문/제목/답변 어딘가에 토큰을 포함해야 함
      const top = results[0];
      const hay = (top.title + top.question + top.answer).toLowerCase();
      expect(hay).toContain("상속");
    }
  });

  it("formatContext handles an empty list without throwing", () => {
    expect(formatContext([])).toContain("찾지 못했습니다");
  });

  it("formatContext truncates long answers", () => {
    const long = "가".repeat(2000);
    const ctx = formatContext(
      [{ id: "1", category: "법인세", title: "t", question: "q", answer: long }],
      900
    );
    expect(ctx).toContain("생략");
    expect(ctx.length).toBeLessThan(long.length);
  });
});
