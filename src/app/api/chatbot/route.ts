import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatbotEnabled, askChatbot, type ChatMessage } from "@/lib/chatbot/anthropic";
import { searchConsultations, formatContext } from "@/lib/chatbot/search";

export const dynamic = "force-dynamic";

/** 대화 기록 중 사용자 메시지가 너무 많이 쌓이지 않도록 최근 N턴만 사용 */
const MAX_HISTORY = 12;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!chatbotEnabled()) {
    return NextResponse.json(
      { error: "챗봇이 아직 설정되지 않았습니다. 관리자에게 ANTHROPIC_API_KEY 설정을 요청하세요." },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "메시지가 필요합니다." }, { status: 400 });
  }

  const lastUserMessage = messages[messages.length - 1].content;
  if (typeof lastUserMessage !== "string" || lastUserMessage.trim().length === 0) {
    return NextResponse.json({ error: "메시지가 비어있습니다." }, { status: 400 });
  }
  if (lastUserMessage.length > 4000) {
    return NextResponse.json({ error: "메시지가 너무 깁니다 (4000자 이내)." }, { status: 400 });
  }

  const history = messages.slice(-MAX_HISTORY);
  const related = searchConsultations(lastUserMessage, 5);
  const context = formatContext(related);

  try {
    const answer = await askChatbot(history, context);
    return NextResponse.json({
      answer,
      sources: related.map((r) => ({ id: r.id, category: r.category, title: r.title })),
    });
  } catch {
    return NextResponse.json(
      { error: "답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }
}
