/**
 * 카카오워크 봇 API 클라이언트 (서버 전용).
 * App Key(KAKAOWORK_APP_KEY) 미설정 시 모든 발송이 조용히 skip 되어
 * 결재 흐름에는 전혀 영향을 주지 않는다. (외부 장애 격리)
 *
 * 발송 흐름(DM): 이메일 → 사용자 조회 → 1:1 대화 열기 → 메시지 전송.
 */
const API_BASE = "https://api.kakaowork.com/v1";

/**
 * 환경변수 값 정리 — Vercel 등에서 값 칸에 "KEY=값"을 통째로 붙여넣는 실수를 방어한다.
 * 앞뒤 공백 제거 + 선행 "KEY=" 접두어 제거.
 */
function cleanEnv(name: string): string | undefined {
  let v = process.env[name];
  if (!v) return undefined;
  v = v.trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  return v || undefined;
}

const APP_KEY = cleanEnv("KAKAOWORK_APP_KEY");
/** 연차 승인 공지 — Incoming Webhook URL (권장, 가장 간단) */
const ANNOUNCE_WEBHOOK_URL = cleanEnv("KAKAOWORK_LEAVE_ANNOUNCE_WEBHOOK_URL");
/** 연차 승인 공지 — 봇으로 게시할 대화방 conversation_id (봇이 참여 중이어야 함) */
const ANNOUNCE_CONVERSATION_ID = cleanEnv("KAKAOWORK_LEAVE_ANNOUNCE_ID");

/** 카카오워크 DM 활성화 여부 (App Key 필요) */
export function kakaoworkEnabled(): boolean {
  return Boolean(APP_KEY);
}

/** 연차 승인 공지 활성화 여부 — 웹훅 URL은 App Key 없이도 동작한다. */
export function announceEnabled(): boolean {
  return Boolean(ANNOUNCE_WEBHOOK_URL) || Boolean(APP_KEY && ANNOUNCE_CONVERSATION_ID);
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
  console.log(
    `[kakaowork][diag] announce webhookSet=${Boolean(ANNOUNCE_WEBHOOK_URL)} startsWithHttp=${ANNOUNCE_WEBHOOK_URL?.startsWith("http") ?? false} convIdSet=${Boolean(ANNOUNCE_CONVERSATION_ID)}`
  );
  try {
    if (ANNOUNCE_WEBHOOK_URL) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(ANNOUNCE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error(`[kakaowork] 공지 웹훅 실패 HTTP ${res.status}`);
        } else {
          console.log(`[kakaowork][diag] 공지 웹훅 OK ${res.status}`);
        }
      } finally {
        clearTimeout(timer);
      }
      return;
    }
    if (APP_KEY && ANNOUNCE_CONVERSATION_ID) {
      await sendMessage(ANNOUNCE_CONVERSATION_ID, text);
      return;
    }
    console.warn(
      "[kakaowork] 공지 대상 미설정 — KAKAOWORK_LEAVE_ANNOUNCE_WEBHOOK_URL(또는 APP_KEY+ANNOUNCE_ID)을 확인하세요"
    );
  } catch (e) {
    console.error("[kakaowork] 공지 발송 실패", e);
  }
}
