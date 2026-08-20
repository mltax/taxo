/**
 * KACTA(한국세무사회) 전문세무상담 데이터에서 질문과 관련된 상담 사례를 찾는
 * 간단한 키워드 기반 검색기 (임베딩/벡터DB 없이 동작 — 별도 인프라 불필요).
 *
 * consultations.json은 한국세무사회 전문세무상담센터의 공개 답변 사례를
 * 정리한 것으로, 개인 식별 정보(질문자/답변자/조회수 등)는 제외하고
 * 세목/제목/질문/답변 내용만 담고 있다.
 */
import consultations from "./consultations.json";

export interface Consultation {
  id: string;
  category: string;
  title: string;
  question: string;
  answer: string;
}

const DATA = consultations as Consultation[];

/** 한글/영문/숫자 2글자 이상 토큰만 추출 (조사·기호 등 노이즈 제거) */
function tokenize(text: string): string[] {
  const matches = text.match(/[가-힣a-zA-Z0-9]{2,}/g) ?? [];
  return matches.map((t) => t.toLowerCase());
}

/**
 * 질문(query)과 관련성 높은 상담 사례 top-K를 반환한다.
 * 점수 = 제목 매칭(가중치 3) + 질문 매칭(가중치 2) + 답변 매칭(가중치 1) 토큰 수.
 */
export function searchConsultations(query: string, topK = 5): Consultation[] {
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return [];

  const scored = DATA.map((c) => {
    const title = c.title.toLowerCase();
    const question = c.question.toLowerCase();
    const answer = c.answer.toLowerCase();
    let score = 0;
    for (const t of queryTokens) {
      if (title.includes(t)) score += 3;
      if (question.includes(t)) score += 2;
      if (answer.includes(t)) score += 1;
    }
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.c);
}

/** 프롬프트에 넣을 때 답변이 너무 길면 잘라서 토큰 사용량을 제한한다. */
export function formatContext(items: Consultation[], maxAnswerChars = 900): string {
  if (items.length === 0) return "(관련된 기존 상담 사례를 찾지 못했습니다.)";
  return items
    .map((c, i) => {
      const answer =
        c.answer.length > maxAnswerChars
          ? c.answer.slice(0, maxAnswerChars) + "…(생략)"
          : c.answer;
      return `[사례 ${i + 1}] (${c.category}) ${c.title}\n질문: ${c.question.slice(0, 500)}\n답변: ${answer}`;
    })
    .join("\n\n");
}
