"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";

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
    const path = `${post.id}/${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) throw new Error(`파일 업로드 실패: ${file.name}`);
    await supabase
      .from("post_files")
      .insert({ post_id: post.id, file_path: path, file_name: file.name });
  }

  revalidatePath(`/board/${boardType}`);
  redirect(`/board/${post.id}`);
}
