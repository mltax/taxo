/**
 * 카카오워크 봇 API 클라이언트 (서버 전용).
 * App Key(KAKAOWORK_APP_KEY) 미설정 시 모든 발송이 조용히 skip 되어
 * 결재 흐름에는 전혀 영향을 주지 않는다. (외부 장애 격리)
 *
 * 발송 흐름(DM): 이메일 → 사용자 조회 → 1:1 대화 열기 → 메시지 전송.
 */
const API_BASE = "https://api.kakaowork.com/v1";
const APP_KEY = process.env.KAKAOWORK_APP_KEY;
/** 연차 승인 공지 — Incoming Webhook URL (권장, 가장 간단) */
const ANNOUNCE_WEBHOOK_URL = process.env.KAKAOWORK_LEAVE_ANNOUNCE_WEBHOOK_URL;
/** 연차 승인 공지 — 봇으로 게시할 대화방 conversation_id (봇이 참여 중이어야 함) */
const ANNOUNCE_CONVERSATION_ID = process.env.KAKAOWORK_LEAVE_ANNOUNCE_ID;

/** 카카오워크 연동 활성화 여부 (App Key 미설정 시 전 기능 no-op) */
export function kakaoworkEnabled(): boolean {
  return Boolean(APP_KEY);
}

/** 외부 호출이 매달리지 않도록 4초 타임아웃 */
async function kwFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${APP_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function findUserIdByEmail(email: string): Promise<number | null> {
  const res = await kwFetch(`/users.find_by_email?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });
  const json = await res.json();
  const id = json?.user?.id;
  return id ? Number(id) : null;
}

async function openDirectConversation(userId: number): Promise<string | null> {
  const res = await kwFetch("/conversations.open", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  const json = await res.json();
  const id = json?.conversation?.id;
  // conversation_id 는 문자열로 전달해야 한다 (숫자 전달 시 일부 요청 거부됨)
  return id ? String(id) : null;
}

async function sendMessage(conversationId: string, text: string): Promise<void> {
  await kwFetch("/messages.send", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, text }),
  });
}

/** 이메일로 사용자를 찾아 1:1 메시지 발송 (실패해도 예외를 던지지 않음) */
export async function sendKakaoworkDM(email: string, text: string): Promise<void> {
  if (!APP_KEY) return;
  try {
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      console.warn(`[kakaowork] 사용자를 찾지 못함(이메일 불일치 가능): ${email}`);
      return;
    }
    const conversationId = await openDirectConversation(userId);
    if (!conversationId) return;
    await sendMessage(conversationId, text);
  } catch (e) {
    console.error("[kakaowork] DM 발송 실패", e);
  }
}

/**
 * 연차 승인 공지 발송 (실패해도 예외를 던지지 않음).
 * 우선순위: Incoming Webhook URL > 봇 messages.send(conversation_id).
 * 둘 다 미설정 시 조용히 skip.
 */
export async function sendKakaoworkAnnounce(text: string): Promise<void> {
  try {
    if (ANNOUNCE_WEBHOOK_URL) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(ANNOUNCE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      return;
    }
    if (APP_KEY && ANNOUNCE_CONVERSATION_ID) {
      await sendMessage(ANNOUNCE_CONVERSATION_ID, text);
    }
  } catch (e) {
    console.error("[kakaowork] 공지 발송 실패", e);
  }
}
