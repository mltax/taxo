/**
 * 세무 챗봇용 Claude(Anthropic) API 클라이언트 (서버 전용).
 * ANTHROPIC_API_KEY 미설정 시 chatbotEnabled()가 false를 반환하며,
 * 라우트에서 이를 확인해 안내 메시지로 조용히 대체한다. (외부 장애/미설정 격리)
 */
import Anthropic from "@anthropic-ai/sdk";

/** 환경변수 값 정리 — 값 칸에 "KEY=값"을 통째로 붙여넣는 실수를 방어한다. */
function cleanEnv(name: string): string | undefined {
  let v = process.env[name];
  if (!v) return undefined;
  v = v.trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  return v || undefined;
}

const API_KEY = cleanEnv("ANTHROPIC_API_KEY");
const MODEL = cleanEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: API_KEY });
  return client;
}

export function chatbotEnabled(): boolean {
  return Boolean(API_KEY);
}

const SYSTEM_PROMPT = `당신은 세무법인 한영(창원)의 사내 세무 상담 도우미입니다.
아래 제공되는 [참고 사례]는 한국세무사회 전문세무상담센터의 기존 상담 답변입니다.
이를 참고하여 질문에 답하되, 다음 원칙을 지키세요.

1. 참고 사례에 근거가 있으면 이를 활용해 답변하고, 관련 사례가 없거나 불충분하면 그렇다고 명확히 밝히세요.
2. 세법은 개정이 잦고 사안마다 사실관계가 다르므로, 답변은 참고용이며 최종 판단은 반드시 담당 세무사가
   법령/예규를 재확인해야 한다는 점을 답변 말미에 안내하세요.
3. 불확실한 내용을 단정적으로 말하지 마세요.
4. 간결하고 실무적인 어투로 답변하세요.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 타임아웃 가드 포함 — 20초 내 응답 없으면 중단 */
export async function askChatbot(
  history: ChatMessage[],
  context: string
): Promise<string> {
  const anthropic = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 1500,
        system: `${SYSTEM_PROMPT}\n\n[참고 사례]\n${context}`,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      },
      { signal: controller.signal }
    );
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  } finally {
    clearTimeout(timer);
  }
}
