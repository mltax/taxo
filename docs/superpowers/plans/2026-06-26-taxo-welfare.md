# 복지 청구·승인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원이 복지 항목을 골라 금액·사유·증빙을 첨부해 신청하면, 결재자가 승인/반려하고, 관리자가 지급 완료 처리하는 결재 흐름을 구현한다.

**Architecture:** 기반(Foundation) 위에 구축. 상태 전이는 순수 함수(`src/lib/welfare/state.ts`)로 분리해 TDD. 데이터 변경은 Next.js Server Actions로 처리하고 RLS가 권한을 강제. 증빙 파일은 Supabase Storage 비공개 버킷(`receipts`)에 저장하고 storage RLS로 보호.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase(Postgres·Storage·RLS), shadcn/ui, Vitest

**전제(기반에서 완료됨):** `welfare_items`, `welfare_claims`, `attachments` 테이블과 RLS 정책은 이미 존재. `requireUser()`, `canApprove()`, `canAdmin()`, Supabase 서버/브라우저 클라이언트도 존재. Supabase 프로젝트 ref: `ganihzhdyazowrhmsttl` (MCP `apply_migration`로 적용).

---

## 설계 결정 (MVP 단순화)
- **공유 승인함:** 신청 시 특정 결재자를 지정하지 않는다. 모든 결재자/관리자가 보는 공유 "승인 대기함"에서 처리하고, 승인 시점에 `approver_id`에 처리자를 기록한다. (16~40명 규모에 적합)
- **상태 흐름:** 신청 = `pending` 생성. `pending` →(승인)→ `approved` →(지급)→ `paid`. `pending` →(반려)→ `rejected`(사유 필수). `draft`는 MVP에서 사용하지 않는다(폼에서 바로 제출).
- **권한:** 신청=본인, 승인/반려=결재자·관리자, 지급처리=관리자.

## File Structure (이 계획에서 만드는 것)
```
src/
├─ lib/welfare/
│  ├─ state.ts          # 상태 전이 순수 함수 (TDD)
│  ├─ types.ts          # Claim/Item 타입, 상태 라벨
│  └─ actions.ts        # Server Actions: submit/approve/reject/markPaid
├─ app/(app)/welfare/
│  ├─ page.tsx          # 신청 폼 + 내 신청 목록
│  ├─ claim-form.tsx    # 신청 폼 (client)
│  └─ inbox/page.tsx    # 승인 대기함 + 승인됨(지급) 목록
├─ components/
│  └─ status-badge.tsx  # 상태 뱃지
supabase/migrations/
└─ 0004_storage_receipts.sql   # 버킷 + storage RLS
tests/
└─ welfare-state.test.ts
```

---

## Task 1: 증빙 파일용 Storage 버킷 + RLS

**Files:**
- Create: `supabase/migrations/0004_storage_receipts.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0004_storage_receipts.sql`:
```sql
-- 비공개 버킷 생성
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 업로드: 인증 사용자가 본인(owner) 파일로 업로드
create policy "receipts insert own"
on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and owner = auth.uid());

-- 조회: 본인 파일 또는 결재자/관리자
create policy "receipts select own or approver"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (owner = auth.uid() or public.current_role() in ('approver','admin'))
);

-- 삭제: 본인 파일만 (반려 후 정리 등)
create policy "receipts delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and owner = auth.uid());
```

- [ ] **Step 2: 적용** — Supabase MCP `apply_migration`(name: `storage_receipts`) 또는 SQL Editor로 적용.
Expected: 버킷 `receipts` 생성, 정책 3개 생성, 에러 없음.

- [ ] **Step 3: 확인**
```sql
select id, public from storage.buckets where id = 'receipts';
```
Expected: `receipts | false`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0004_storage_receipts.sql
git commit -m "feat: add private receipts storage bucket with RLS"
```

---

## Task 2: 복지 청구 상태 전이 순수 함수 (TDD)

**Files:**
- Create: `src/lib/welfare/state.ts`
- Test: `tests/welfare-state.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/welfare-state.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextStatus, type ClaimStatus, type ClaimAction } from "@/lib/welfare/state";

describe("welfare claim state machine", () => {
  it("approve: pending -> approved", () => {
    expect(nextStatus("pending", "approve")).toBe("approved");
  });
  it("reject: pending -> rejected", () => {
    expect(nextStatus("pending", "reject")).toBe("rejected");
  });
  it("pay: approved -> paid", () => {
    expect(nextStatus("approved", "pay")).toBe("paid");
  });
  it("cannot approve an already approved claim", () => {
    expect(() => nextStatus("approved", "approve")).toThrow();
  });
  it("cannot pay a pending claim", () => {
    expect(() => nextStatus("pending", "pay")).toThrow();
  });
  it("cannot act on a paid claim", () => {
    const actions: ClaimAction[] = ["approve", "reject", "pay"];
    for (const a of actions) {
      expect(() => nextStatus("paid", a)).toThrow();
    }
  });
});
```

- [ ] **Step 2: 실패 확인**
```bash
npm test -- welfare-state
```
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**

`src/lib/welfare/state.ts`:
```ts
export type ClaimStatus = "draft" | "pending" | "approved" | "rejected" | "paid";
export type ClaimAction = "approve" | "reject" | "pay";

const TRANSITIONS: Record<ClaimAction, { from: ClaimStatus; to: ClaimStatus }> = {
  approve: { from: "pending", to: "approved" },
  reject: { from: "pending", to: "rejected" },
  pay: { from: "approved", to: "paid" },
};

/** 허용된 전이면 다음 상태를 반환, 아니면 throw. */
export function nextStatus(current: ClaimStatus, action: ClaimAction): ClaimStatus {
  const t = TRANSITIONS[action];
  if (!t || t.from !== current) {
    throw new Error(`잘못된 상태 전이: ${current} -> ${action}`);
  }
  return t.to;
}
```

- [ ] **Step 4: 통과 확인**
```bash
npm test -- welfare-state
```
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**
```bash
git add src/lib/welfare/state.ts tests/welfare-state.test.ts
git commit -m "feat: add welfare claim state machine with tests"
```

---

## Task 3: 타입 + 상태 라벨 + 상태 뱃지

**Files:**
- Create: `src/lib/welfare/types.ts`, `src/components/status-badge.tsx`

- [ ] **Step 1: 타입/라벨 작성**

`src/lib/welfare/types.ts`:
```ts
import type { ClaimStatus } from "@/lib/welfare/state";

export interface WelfareItem {
  id: string;
  name: string;
  monthly_limit: number | null;
}

export interface WelfareClaim {
  id: string;
  user_id: string;
  item_id: string;
  amount: number;
  reason: string;
  status: ClaimStatus;
  approver_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "작성중",
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
  paid: "지급 완료",
};
```

- [ ] **Step 2: 상태 뱃지 컴포넌트**

`src/components/status-badge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";
import type { ClaimStatus } from "@/lib/welfare/state";
import { STATUS_LABEL } from "@/lib/welfare/types";

const VARIANT: Record<ClaimStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "default",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 4: Commit**
```bash
git add src/lib/welfare/types.ts src/components/status-badge.tsx
git commit -m "feat: add welfare types, status labels, and status badge"
```

---

## Task 4: Server Actions (submit / approve / reject / markPaid)

**Files:**
- Create: `src/lib/welfare/actions.ts`

- [ ] **Step 1: 작성**

`src/lib/welfare/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove, canAdmin } from "@/lib/roles";

/** 직원: 복지 청구 신청 (pending 생성 + 증빙 업로드) */
export async function submitClaim(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const itemId = String(formData.get("item_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!itemId) throw new Error("복지 항목을 선택하세요.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("금액을 올바르게 입력하세요.");
  if (!reason) throw new Error("사유를 입력하세요.");

  // 청구 생성 (status 기본값 pending)
  const { data: claim, error } = await supabase
    .from("welfare_claims")
    .insert({ user_id: user.id, item_id: itemId, amount, reason })
    .select("id")
    .single();
  if (error || !claim) throw new Error("신청 저장에 실패했습니다.");

  // 증빙 파일 업로드 (선택)
  if (file && file.size > 0) {
    const path = `${user.id}/${claim.id}/${file.name}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
    if (upErr) throw new Error("증빙 업로드에 실패했습니다.");
    await supabase
      .from("attachments")
      .insert({ claim_id: claim.id, file_path: path, file_name: file.name });
  }

  revalidatePath("/welfare");
}

/** 결재자/관리자: 승인 */
export async function approveClaim(claimId: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "approved", approver_id: user.id, approved_at: new Date().toISOString() })
    .eq("id", claimId)
    .eq("status", "pending"); // 동시성: 대기중일 때만
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}

/** 결재자/관리자: 반려 (사유 필수) */
export async function rejectClaim(claimId: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "rejected", approver_id: user.id, reject_reason: trimmed })
    .eq("id", claimId)
    .eq("status", "pending");
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}

/** 관리자: 지급 완료 처리 */
export async function markPaid(claimId: string) {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("지급 처리 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("welfare_claims")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", claimId)
    .eq("status", "approved");
  if (error) throw new Error("지급 처리에 실패했습니다.");
  revalidatePath("/welfare/inbox");
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add src/lib/welfare/actions.ts
git commit -m "feat: add welfare claim server actions"
```

---

## Task 5: 신청 폼 + 내 신청 목록 (/welfare)

**Files:**
- Create: `src/app/(app)/welfare/claim-form.tsx`, `src/app/(app)/welfare/page.tsx`

- [ ] **Step 1: 신청 폼 (client)**

`src/app/(app)/welfare/claim-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { submitClaim } from "@/lib/welfare/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WelfareItem } from "@/lib/welfare/types";

export function ClaimForm({ items }: { items: WelfareItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitClaim(formData);
      (document.getElementById("claim-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="claim-form" action={action} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="item_id">복지 항목</Label>
        <select id="item_id" name="item_id" required className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">선택하세요</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">금액 (원)</Label>
        <Input id="amount" name="amount" type="number" min="1" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">사유</Label>
        <Input id="reason" name="reason" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">증빙 첨부 (선택)</Label>
        <Input id="file" name="file" type="file" accept="image/*,application/pdf" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "제출 중..." : "제출하기"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: 페이지 (server) — 항목 조회 + 내 신청 목록**

`src/app/(app)/welfare/page.tsx`:
```tsx
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "./claim-form";
import { StatusBadge } from "@/components/status-badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { WelfareItem, WelfareClaim } from "@/lib/welfare/types";

export default async function WelfarePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("welfare_items")
    .select("id, name, monthly_limit")
    .eq("is_active", true)
    .order("name");

  const { data: claims } = await supabase
    .from("welfare_claims")
    .select("id, item_id, amount, reason, status, created_at, reject_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">복지 청구</h1>
        <Card>
          <CardHeader><CardTitle>새 신청</CardTitle></CardHeader>
          <CardContent>
            <ClaimForm items={(items ?? []) as WelfareItem[]} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 신청 내역</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>항목</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>사유</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>신청일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(claims ?? []).map((c: Partial<WelfareClaim>) => (
              <TableRow key={c.id}>
                <TableCell>{itemName.get(c.item_id!) ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell>
                  {c.reason}
                  {c.status === "rejected" && c.reject_reason && (
                    <span className="block text-xs text-destructive">반려: {c.reject_reason}</span>
                  )}
                </TableCell>
                <TableCell><StatusBadge status={c.status!} /></TableCell>
                <TableCell>{c.created_at?.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {(claims ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/welfare` 라우트 생성)

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/welfare/
git commit -m "feat: add welfare claim form and my-claims list"
```

---

## Task 6: 승인 대기함 + 승인/반려 (/welfare/inbox)

**Files:**
- Create: `src/app/(app)/welfare/inbox/page.tsx`, `src/app/(app)/welfare/inbox/claim-actions.tsx`

- [ ] **Step 1: 행동 버튼 (client) — 승인/반려/지급**

`src/app/(app)/welfare/inbox/claim-actions.tsx`:
```tsx
"use client";

import { useState } from "react";
import { approveClaim, rejectClaim, markPaid } from "@/lib/welfare/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PendingActions({ claimId }: { claimId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {!rejecting ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await approveClaim(claimId); setBusy(false); }}>
            승인
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting(true)}>
            반려
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유" className="h-8" />
          <Button size="sm" variant="destructive" disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); await rejectClaim(claimId, reason); setBusy(false); }}>
            확인
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>취소</Button>
        </div>
      )}
    </div>
  );
}

export function PayAction({ claimId }: { claimId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await markPaid(claimId); setBusy(false); }}>
      지급 완료 처리
    </Button>
  );
}
```

- [ ] **Step 2: 페이지 (server) — 권한 가드 + 대기/승인 목록**

`src/app/(app)/welfare/inbox/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove, canAdmin } from "@/lib/roles";
import { PendingActions, PayAction } from "./claim-actions";
import { StatusBadge } from "@/components/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function InboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  // 신청자 이름까지 조인
  const { data: pending } = await supabase
    .from("welfare_claims")
    .select("id, amount, reason, created_at, users:user_id(name), welfare_items:item_id(name)")
    .eq("status", "pending")
    .order("created_at");

  const { data: approved } = await supabase
    .from("welfare_claims")
    .select("id, amount, reason, approved_at, users:user_id(name), welfare_items:item_id(name)")
    .eq("status", "approved")
    .order("approved_at");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">승인 대기함</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>신청자</TableHead><TableHead>항목</TableHead>
              <TableHead>금액</TableHead><TableHead>사유</TableHead>
              <TableHead>신청일</TableHead><TableHead>처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pending ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.users?.name ?? "-"}</TableCell>
                <TableCell>{c.welfare_items?.name ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell>{c.reason}</TableCell>
                <TableCell>{c.created_at?.slice(0, 10)}</TableCell>
                <TableCell><PendingActions claimId={c.id} /></TableCell>
              </TableRow>
            ))}
            {(pending ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">대기 중인 신청이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">승인됨 (지급 대기)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>신청자</TableHead><TableHead>항목</TableHead>
              <TableHead>금액</TableHead><TableHead>상태</TableHead>
              <TableHead>{canAdmin(user.role) ? "지급" : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(approved ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.users?.name ?? "-"}</TableCell>
                <TableCell>{c.welfare_items?.name ?? "-"}</TableCell>
                <TableCell>{c.amount?.toLocaleString()}원</TableCell>
                <TableCell><StatusBadge status="approved" /></TableCell>
                <TableCell>{canAdmin(user.role) ? <PayAction claimId={c.id} /> : null}</TableCell>
              </TableRow>
            ))}
            {(approved ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">승인된 신청이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/welfare/inbox` 라우트 생성)

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/welfare/inbox/
git commit -m "feat: add approver inbox with approve/reject/pay actions"
```

---

## Task 7: 대시보드 위젯 (내 신청 현황 + 결재 대기 건수)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (전체 교체)

- [ ] **Step 1: 대시보드 교체**

`src/app/(app)/dashboard/page.tsx` 전체를 교체:
```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // 내 신청 상태별 건수
  const { data: myClaims } = await supabase
    .from("welfare_claims")
    .select("status")
    .eq("user_id", user.id);
  const myPending = (myClaims ?? []).filter((c) => c.status === "pending").length;

  // 결재자: 승인 대기 건수
  let inboxCount = 0;
  if (canApprove(user.role)) {
    const { count } = await supabase
      .from("welfare_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    inboxCount = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">홈</h1>
        <p className="text-muted-foreground">{user.name} 님, 환영합니다.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/welfare">
          <Card className="transition hover:bg-muted/50">
            <CardHeader><CardTitle className="text-base">내 승인 대기</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{myPending}건</CardContent>
          </Card>
        </Link>
        {canApprove(user.role) && (
          <Link href="/welfare/inbox">
            <Card className="transition hover:bg-muted/50">
              <CardHeader><CardTitle className="text-base">결재 대기함</CardTitle></CardHeader>
              <CardContent className="text-3xl font-bold">{inboxCount}건</CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add dashboard widgets for claims and inbox"
```

---

## Task 8: 전체 검증 + 수동 E2E

- [ ] **Step 1: 단위 테스트 + 빌드**
```bash
npm test && npm run build
```
Expected: 모든 테스트 PASS (smoke 1 + roles 5 + welfare-state 6 = 12), 빌드 성공.

- [ ] **Step 2: 수동 E2E (dev 서버)**
```bash
npm run dev
```
관리자(이태규)로 로그인 후:
1. `/welfare`에서 항목·금액·사유 입력하고 제출 → "내 신청 내역"에 **승인 대기**로 표시되는지
2. `/welfare/inbox`에서 방금 신청이 보이고 **승인** 클릭 → 목록에서 사라지고 "승인됨(지급 대기)"으로 이동하는지
3. 관리자이므로 **지급 완료 처리** 클릭 → `/welfare`의 내 내역에서 상태가 **지급 완료**로 바뀌는지
4. 새 신청을 하나 더 만들어 **반려**(사유 입력) → 내 내역에서 **반려됨** + 사유 표시되는지
5. `/dashboard`에서 건수 위젯이 반영되는지

Expected: 위 흐름이 모두 동작.

> 참고: 현재 관리자 1명만 있어 신청·결재를 한 계정으로 테스트한다. 직원/결재자 권한 분리 테스트는 관리자 화면(계획 3 이후의 직원 계정 관리)에서 계정을 추가한 뒤 수행한다. RLS상 직원은 `/welfare/inbox` 접근 시 `/dashboard`로 리다이렉트된다.

---

## Self-Review 결과 (작성자 점검)
- **스펙 커버리지:** 신청(증빙첨부 포함) ✓, 1단계 승인/반려(사유) ✓, 관리자 지급처리 ✓, 상태흐름 draft 제외 pending→approved→paid / rejected ✓, 대시보드 현황 ✓, 권한(서버액션 가드 + RLS + inbox 리다이렉트) ✓, 증빙 비공개 저장 ✓.
- **플레이스홀더:** 없음. 모든 코드 스텝에 실제 코드 포함.
- **타입 일관성:** `ClaimStatus`/`ClaimAction`은 `state.ts` 정의를 `types.ts`·`status-badge.tsx`·actions에서 재사용. `nextStatus`는 순수함수 테스트로 검증하고, 서버 액션은 DB의 `.eq("status", ...)` 조건으로 동일한 전이 규칙을 동시성 안전하게 강제.
- **주의:** inbox 페이지의 조인 결과는 Supabase 타입 추론 한계로 `any` 사용(MVP 허용). 추후 `generate_typescript_types`로 타입 생성 시 개선 가능.

---

## 다음 계획
- **계획 3 — 자료실·공지:** 게시판 목록/상세/작성, 파일 업/다운로드, 대시보드 공지 노출.
