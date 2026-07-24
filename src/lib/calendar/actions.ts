"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canManageEvents } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getCalendarEvents } from "@/lib/calendar/events";
import { sendKakaoworkAnnounce } from "@/lib/kakaowork/client";
import { formatPeriodKo } from "@/lib/leave/calc";

/** 캘린더 공유 일정 조회 (인증 사용자 전체) */
export async function fetchCalendarEvents(year: number, month: number) {
  await requireUser();
  return getCalendarEvents(year, month);
}

/** 관리자(인사관리자·대표): 공유 일정 등록 */
export async function addCalendarEvent(input: {
  title: string;
  startDate: string;
  endDate: string;
}) {
  const user = await requireUser();
  if (!canManageEvents(user.role)) throw new Error("일정 등록 권한이 없습니다.");

  const title = input.title.trim();
  if (!title || title.length > 10) throw new Error("일정명은 1~10자로 입력하세요.");
  if (!input.startDate || !input.endDate) throw new Error("기간을 입력하세요.");
  if (input.endDate < input.startDate) throw new Error("종료일이 시작일보다 빠릅니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").insert({
    title,
    start_date: input.startDate,
    end_date: input.endDate,
    created_by: user.id,
  });
  if (error) throw new Error("일정 저장에 실패했습니다.");
  // 응답 후 공지방에 일정 등록 알림 (연차 승인 공지와 동일 — 웹훅, 실패해도 무해)
  after(async () => {
    try {
      await sendKakaoworkAnnounce(
        `📅 [일정 공지]\n` +
          `${title}\n` +
          `기간: ${formatPeriodKo(input.startDate, input.endDate)}\n` +
          `등록: ${user.name}`
      );
    } catch (e) {
      console.error(e);
    }
  });
  revalidatePath("/dashboard");
}

/** 관리자(인사관리자·대표): 공유 일정 삭제 */
export async function deleteCalendarEvent(id: string) {
  const user = await requireUser();
  if (!canManageEvents(user.role)) throw new Error("일정 삭제 권한이 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error("일정 삭제에 실패했습니다.");
  revalidatePath("/dashboard");
}
