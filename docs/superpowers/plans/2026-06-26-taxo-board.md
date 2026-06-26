# 자료실·공지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원이 사내 자료(양식·법규·매뉴얼)와 공지를 열람·다운로드하고, 결재자·관리자가 글과 파일을 등록할 수 있는 자료실을 구현한다.

**Architecture:** 기반·복지 위에 구축. 글/공지는 `posts`, 첨부는 `post_files`(기반에서 생성됨, RLS 포함). 파일은 Supabase Storage 비공개 버킷 `documents`에 저장하고, 다운로드는 서버에서 서명 URL을 발급. 글쓰기는 결재자·관리자만(서버 액션 가드 + RLS).

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase(Postgres·Storage·RLS), shadcn/ui

**전제(완료됨):** `posts`(author_id, category, title, body, is_notice, created_at), `post_files`(post_id, file_path, file_name) 테이블 + RLS(조회=인증 사용자 전체, 작성=approver/admin) 존재. `requireUser`, `canApprove`, Supabase 클라이언트 존재.

---

## 설계 결정 (MVP)
- **카테고리**는 고정 목록(사내양식 / 법규 / 업무매뉴얼 / 일반)에서 선택. 관리형 분류는 YAGNI.
- **공지(is_notice)** 글은 목록 상단·대시보드에 노출.
- **삭제·수정**은 MVP 범위 밖(YAGNI). 글쓰기·열람·다운로드만.
- 파일 다운로드는 `createSignedUrl`(60초)로 비공개 버킷 접근.

## File Structure
```
src/
├─ lib/board/
│  ├─ constants.ts     # 카테고리 목록
│  └─ actions.ts       # Server Action: createPost (+파일 업로드)
├─ app/(app)/board/
│  ├─ page.tsx         # 목록 (공지 상단 + 카테고리)
│  ├─ new/page.tsx     # 글쓰기 (approver/admin 가드)
│  ├─ new/post-form.tsx# 글쓰기 폼 (client)
│  └─ [id]/page.tsx    # 상세 + 첨부 다운로드(서명 URL)
supabase/migrations/
└─ 0005_storage_documents.sql
```

---

## Task 1: 자료 파일용 Storage 버킷 + RLS

**Files:**
- Create: `supabase/migrations/0005_storage_documents.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0005_storage_documents.sql`:
```sql
-- 비공개 버킷 (자료실 첨부)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 조회/다운로드: 모든 인증 사용자
create policy "documents select authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'documents');

-- 업로드: 결재자/관리자
create policy "documents insert approver"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.current_role() in ('approver','admin'));

-- 삭제: 결재자/관리자
create policy "documents delete approver"
on storage.objects for delete to authenticated
using (bucket_id = 'documents' and public.current_role() in ('approver','admin'));
```

- [ ] **Step 2: 적용** — Supabase MCP `apply_migration`(name: `storage_documents`) 또는 SQL Editor.
Expected: 버킷 `documents` 생성, 정책 3개, 에러 없음.

- [ ] **Step 3: 확인**
```sql
select id, public from storage.buckets where id = 'documents';
```
Expected: `documents | false`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0005_storage_documents.sql
git commit -m "feat: add private documents storage bucket with RLS"
```

---

## Task 2: 카테고리 상수

**Files:**
- Create: `src/lib/board/constants.ts`

- [ ] **Step 1: 작성**

`src/lib/board/constants.ts`:
```ts
export const BOARD_CATEGORIES = ["사내양식", "법규", "업무매뉴얼", "일반"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/board/constants.ts
git commit -m "feat: add board category constants"
```

---

## Task 3: Server Action — 글 작성 (+파일 업로드)

**Files:**
- Create: `src/lib/board/actions.ts`

- [ ] **Step 1: 작성**

`src/lib/board/actions.ts`:
```ts
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
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title) throw new Error("제목을 입력하세요.");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, title, category, body, is_notice: isNotice })
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

  revalidatePath("/board");
  redirect(`/board/${post.id}`);
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add src/lib/board/actions.ts
git commit -m "feat: add createPost server action with file upload"
```

---

## Task 4: 자료실 목록 (/board)

**Files:**
- Create: `src/app/(app)/board/page.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/board/page.tsx`:
```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function BoardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, category, is_notice, created_at, users:author_id(name)")
    .order("is_notice", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">자료실</h1>
        {canApprove(user.role) && (
          <Link href="/board/new"><Button>글쓰기</Button></Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">분류</TableHead>
            <TableHead>제목</TableHead>
            <TableHead className="w-28">작성자</TableHead>
            <TableHead className="w-28">작성일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(posts ?? []).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
              <TableCell>
                <Link href={`/board/${p.id}`} className="hover:underline">
                  {p.is_notice && <Badge className="mr-2">공지</Badge>}
                  {p.title}
                </Link>
              </TableCell>
              <TableCell>{p.users?.name ?? "-"}</TableCell>
              <TableCell>{p.created_at?.slice(0, 10)}</TableCell>
            </TableRow>
          ))}
          {(posts ?? []).length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">등록된 자료가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/board` 라우트 생성)

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/board/page.tsx
git commit -m "feat: add board list page"
```

---

## Task 5: 글쓰기 화면 (/board/new)

**Files:**
- Create: `src/app/(app)/board/new/post-form.tsx`, `src/app/(app)/board/new/page.tsx`

- [ ] **Step 1: 글쓰기 폼 (client)**

`src/app/(app)/board/new/post-form.tsx`:
```tsx
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
```

- [ ] **Step 2: 글쓰기 페이지 (server, 권한 가드)**

`src/app/(app)/board/new/page.tsx`:
```tsx
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
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/board/new` 라우트 생성)

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/board/new/
git commit -m "feat: add board post creation page"
```

---

## Task 6: 자료 상세 + 첨부 다운로드 (/board/[id])

**Files:**
- Create: `src/app/(app)/board/[id]/page.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/board/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, category, body, is_notice, created_at, users:author_id(name)")
    .eq("id", id)
    .single();
  if (!post) notFound();

  const { data: files } = await supabase
    .from("post_files")
    .select("id, file_path, file_name")
    .eq("post_id", id);

  // 첨부 파일별 서명 URL (60초)
  const filesWithUrl = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(f.file_path, 60);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const author = (post as any).users?.name ?? "-";

  return (
    <div className="space-y-4">
      <Link href="/board" className="text-sm text-muted-foreground hover:underline">← 목록</Link>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{post.category}</Badge>
            {post.is_notice && <Badge>공지</Badge>}
          </div>
          <CardTitle className="text-xl">{post.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {author} · {post.created_at?.slice(0, 10)}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="whitespace-pre-wrap text-sm">{post.body || "(내용 없음)"}</div>
          {filesWithUrl.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">첨부 파일</p>
              {filesWithUrl.map((f) => (
                <div key={f.id}>
                  {f.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.url} target="_blank" rel="noopener noreferrer">📎 {f.file_name}</a>
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">📎 {f.file_name} (다운로드 불가)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/board/[id]` 동적 라우트 생성)

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/board/\[id\]/
git commit -m "feat: add post detail page with signed-url downloads"
```

---

## Task 7: 대시보드에 최근 공지 노출

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: 대시보드에 공지 섹션 추가**

`src/app/(app)/dashboard/page.tsx`에서 기존 내용을 유지하되, 데이터 조회부에 최근 공지 조회를 추가하고 렌더 마지막에 섹션을 추가한다.

조회부(`inboxCount` 계산 다음)에 추가:
```tsx
  // 최근 공지 (상위 5개)
  const { data: notices } = await supabase
    .from("posts")
    .select("id, title, created_at")
    .eq("is_notice", true)
    .order("created_at", { ascending: false })
    .limit(5);
```

렌더의 카드 그리드(`</div>`로 그리드가 닫힌 직후, 최상위 `</div>` 직전)에 추가:
```tsx
      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 공지</h2>
        <div className="divide-y rounded-md border">
          {(notices ?? []).map((n) => (
            <Link key={n.id} href={`/board/${n.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
              <span className="text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.created_at?.slice(0, 10)}</span>
            </Link>
          ))}
          {(notices ?? []).length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">공지가 없습니다.</p>
          )}
        </div>
      </div>
```

> 참고: `Link`는 이미 대시보드 상단에서 import되어 있다(복지 위젯에서 사용). 추가 import 불필요.

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: show recent notices on dashboard"
```

---

## Task 8: 전체 검증 + 수동 E2E

- [ ] **Step 1: 단위 테스트 + 빌드**
```bash
npm test && npm run build
```
Expected: 기존 테스트 12개 PASS, 빌드 성공. 라우트 `/board`, `/board/new`, `/board/[id]` 생성.

- [ ] **Step 2: 수동 E2E (dev 서버)**
```bash
npm run dev
```
관리자(이태규)로 로그인 후:
1. **자료실** → "글쓰기" → 제목·분류·내용 입력, 파일 첨부, "공지로 등록" 체크 후 등록 → 상세로 이동
2. 상세에서 첨부 파일 다운로드 링크 동작 확인
3. **자료실** 목록에 공지가 상단(공지 뱃지)으로 보이는지
4. **홈** 대시보드 "최근 공지"에 노출되는지
5. (권한) 직원 계정으로는 "글쓰기" 버튼이 안 보이고, `/board/new` 직접 접근 시 `/board`로 리다이렉트(계획 4의 직원계정 추가 후 확인 가능)

Expected: 위 흐름 동작.

---

## Self-Review 결과 (작성자 점검)
- **스펙 커버리지:** 자료 열람(전 직원) ✓, 글·파일 등록(approver/admin) ✓, 카테고리 분류 ✓, 공지 + 대시보드 노출 ✓, 비공개 저장 + 서명 URL 다운로드 ✓, 권한(서버액션 가드 + RLS + new 페이지 리다이렉트) ✓.
- **플레이스홀더:** 없음. Task 7만 부분 수정(기존 파일)이라 추가 위치를 명시했고 코드 제공.
- **타입 일관성:** `BOARD_CATEGORIES`는 constants에서 폼이 사용. posts 조인은 Supabase 추론 한계로 `any`(MVP, 복지 inbox와 동일 방침).
- **주의:** `redirect()`가 Server Action 내부에서 throw하는 `NEXT_REDIRECT`를 폼에서 에러로 오인하지 않도록 메시지 필터를 둠.

---

## 1차 MVP 완료 후
세 계획(기반·복지·자료실)이 끝나면 1차 MVP 완성. 이후:
- **계획 4:** 관리자 화면(직원 계정 발급·복지항목 관리·결재선) → 직원/결재자 분리 운영 시작
- **2차:** 연차 결재, 건의사항
- **3차:** PWA·푸시 알림, 네이티브 앱
