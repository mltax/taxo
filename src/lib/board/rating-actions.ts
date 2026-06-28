"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";

/** 사내 인원: 업무공유 글에 1~5점 익명 투표 (인별 1회, 변경 가능) */
export async function ratePost(postId: string, score: number) {
  const user = await requireUser();
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error("점수는 1~5점만 가능합니다.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_ratings")
    .upsert(
      { post_id: postId, voter_id: user.id, score },
      { onConflict: "post_id,voter_id" }
    );
  if (error) throw new Error("평가 저장에 실패했습니다.");
  revalidatePath(`/board/${postId}`);
}

/** 관리자: 최종 포상 포인트(1000~20000) 부여 */
export async function setRewardPoints(postId: string, points: number) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("포인트 부여 권한이 없습니다.");
  if (!Number.isInteger(points) || points < 1000 || points > 20000) {
    throw new Error("포상 포인트는 1000~20000P 범위로 입력하세요.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ reward_points: points, reward_points_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error("포인트 등록에 실패했습니다.");
  revalidatePath(`/board/${postId}`);
}
