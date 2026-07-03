import { createClient } from "@/lib/supabase/server";
import { monthGridRange } from "@/lib/leave/calendar";

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/** 해당 월 그리드 범위와 겹치는 공유 일정(회의·교육·세미나 등) */
export async function getCalendarEvents(
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const { from, to } = monthGridRange(year, month);
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, title, start_date, end_date")
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date");
  return (
    (data ?? []) as {
      id: string;
      title: string;
      start_date: string;
      end_date: string;
    }[]
  ).map((e) => ({
    id: e.id,
    title: e.title,
    startDate: e.start_date,
    endDate: e.end_date,
  }));
}
