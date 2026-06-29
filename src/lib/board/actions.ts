"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove, canEditPost, canDeletePost, type BoardType } from "@/lib/roles";
import { safeStorageKey } from "@/lib/storage";

/** 결재자/관리자: 자료실 글 작성 (+첨부 업로드) */
export async function createPost(formData: FormData) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("글쓰기 권한이 없습니다.");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "일반");
  const body = String(formData.get("body") ?? "").trim();
  const isNotice = formData.get("is_notice") === "on";
  const boardType = formData.get("board_type") === "free" ? "free" : "work";
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title) throw new Error("제목을 입력하세요.");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, title, category, body, is_notice: isNotice, board_type: boardType })
    .select("id")
    .single();
  if (error || !post) throw new Error("글 저장에 실패했습니다.");

  for (const file of files) {
    const path = safeStorageKey(post.id, file.name);
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) throw new Error(`파일 업로드 실패: ${file.name}`);
    await supabase
      .from("post_files")
      .insert({ post_id: post.id, file_path: path, file_name: file.name });
  }

  revalidatePath(`/board/${boardType}`);
  redirect(`/board/${post.id}`);
}

/** 글 수정 (자유=글쓴이, 업무공유=관리자) */
export async function updatePost(postId: string, formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("board_type, author_id")
    .eq("id", postId)
    .single();
  if (!post) throw new Error("글을 찾을 수 없습니다.");
  if (!canEditPost(user.role, post.board_type as BoardType, post.author_id === user.id)) {
    throw new Error("수정 권한이 없습니다.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "일반");
  const body = String(formData.get("body") ?? "").trim();
  const isNotice = formData.get("is_notice") === "on";
  if (!title) throw new Error("제목을 입력하세요.");

  const { error } = await supabase
    .from("posts")
    .update({ title, category, body, is_notice: isNotice })
    .eq("id", postId);
  if (error) throw new Error("수정에 실패했습니다.");

  revalidatePath(`/board/${postId}`);
  redirect(`/board/${postId}`);
}

/** 글 삭제 (자유=글쓴이/관리자, 업무공유=관리자). 업무공유 포상 포인트는 원장에 적립해 유지 */
export async function deletePost(postId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("board_type, author_id, reward_points")
    .eq("id", postId)
    .single();
  if (!post) throw new Error("글을 찾을 수 없습니다.");
  if (!canDeletePost(user.role, post.board_type as BoardType, post.author_id === user.id)) {
    throw new Error("삭제 권한이 없습니다.");
  }

  // 포인트 유지: 부여된 포상 포인트를 작성자 원장에 적립
  if (post.board_type === "work" && post.reward_points) {
    await supabase.from("point_ledger").insert({
      user_id: post.author_id,
      points: post.reward_points,
      note: "삭제된 업무공유 글 포상 포인트",
    });
  }

  // 첨부 스토리지 정리
  const { data: files } = await supabase
    .from("post_files")
    .select("file_path")
    .eq("post_id", postId);
  if (files && files.length > 0) {
    await supabase.storage.from("documents").remove(files.map((f) => f.file_path));
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw new Error("삭제에 실패했습니다.");

  revalidatePath(`/board/${post.board_type}`);
  redirect(`/board/${post.board_type}`);
}
