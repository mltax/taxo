"use client";

import { useState } from "react";
import Link from "next/link";
import { deletePost } from "@/lib/board/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PostActions({
  postId,
  canEdit,
  canDelete,
}: {
  postId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!canEdit && !canDelete) return null;
  return (
    <div className="flex gap-2">
      {canEdit && (
        <Link
          href={`/board/${postId}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          수정
        </Link>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            if (!confirm("이 글을 삭제하시겠습니까?")) return;
            setBusy(true);
            await deletePost(postId);
            setBusy(false);
          }}
        >
          삭제
        </Button>
      )}
    </div>
  );
}
