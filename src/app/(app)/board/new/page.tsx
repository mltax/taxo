import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";
import { PostForm } from "./post-form";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/board/work");
  const { type } = await searchParams;
  const defaultBoard = type === "free" ? "free" : "work";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">글쓰기</h1>
      <PostForm defaultBoard={defaultBoard} />
    </div>
  );
}
