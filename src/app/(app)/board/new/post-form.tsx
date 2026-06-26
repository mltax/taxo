"use client";

import { useState } from "react";
import { createPost } from "@/lib/board/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOARD_CATEGORIES } from "@/lib/board/constants";

export function PostForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await createPost(formData);
    } catch (e) {
      // redirect()는 예외로 처리되므로 메시지 있는 Error만 표시
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
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">분류</Label>
        <select id="category" name="category" className="w-full rounded-md border px-3 py-2 text-sm">
          {BOARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">내용</Label>
        <textarea id="body" name="body" rows={8} className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input id="is_notice" name="is_notice" type="checkbox" className="h-4 w-4" />
        <Label htmlFor="is_notice">공지로 등록</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">첨부 파일 (여러 개 가능)</Label>
        <Input id="files" name="files" type="file" multiple />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "등록 중..." : "등록"}</Button>
    </form>
  );
}
