import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canEditPost, type BoardType } from "@/lib/roles";
import { EditForm } from "./edit-form";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, category, body, is_notice, board_type, author_id")
    .eq("id", id)
    .single();
  if (!post) notFound();

  if (!canEditPost(user.role, post.board_type as BoardType, post.author_id === user.id)) {
    redirect(`/board/${id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">글 수정</h1>
      <EditForm
        postId={post.id}
        title={post.title}
        category={post.category}
        body={post.body ?? ""}
        isNotice={post.is_notice}
      />
    </div>
  );
}
