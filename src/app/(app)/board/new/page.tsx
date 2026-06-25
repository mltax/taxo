import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";
import { PostForm } from "./post-form";

export default async function NewPostPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/board");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">자료 등록</h1>
      <PostForm />
    </div>
  );
}
