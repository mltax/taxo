"use client";

import { useState } from "react";
import { updatePost } from "@/lib/board/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOARD_CATEGORIES } from "@/lib/board/constants";

interface Props {
  postId: string;
  title: string;
  category: string;
  body: string;
  isNotice: boolean;
}

export function EditForm({ postId, title, category, body, isNotice }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await updatePost(postId, formData);
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.includes("NEXT_REDIRECT")) {
        setError(e.message);
        setPending(false);
      }
    }
  }

  return (
    <form action={action} className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" defaultValue={title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">분류</Label>
        <select id="category" name="category" defaultValue={category} className="w-full rounded-md border px-3 py-2 text-sm">
          {BOARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          {!BOARD_CATEGORIES.includes(category as (typeof BOARD_CATEGORIES)[number]) && (
            <option value={category}>{category}</option>
          )}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">내용</Label>
        <textarea id="body" name="body" rows={8} defaultValue={body} className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input id="is_notice" name="is_notice" type="checkbox" defaultChecked={isNotice} className="h-4 w-4" />
        <Label htmlFor="is_notice">공지로 등록</Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "저장 중..." : "수정 저장"}</Button>
    </form>
  );
}
