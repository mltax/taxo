# 관리자 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 직원 계정을 발급하고(역할·소속 지정, 활성/비활성), 복지 항목을 추가·수정할 수 있는 관리자 화면을 만든다. 결재 권한은 `approver` 역할 부여로 관리한다(별도 결재선 테이블 없음).

**Architecture:** 기반·복지·자료실 위에 구축. 일반 관리 작업(복지항목 CRUD, 역할·활성 변경)은 관리자 세션 + RLS(`current_role()='admin'`)로 처리. 단, **auth 사용자 생성**은 anon/authenticated 권한으로 불가하므로 **service_role 키**를 쓰는 서버 전용 admin 클라이언트로 처리한다(서버 액션 내부에서만).

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase(@supabase/supabase-js admin API), shadcn/ui

**전제(완료됨):** `users`, `welfare_items` 테이블 + RLS(`users_admin_all`, `items_admin_write`) 존재. `requireUser`, `canAdmin`, Supabase 서버 클라이언트 존재. 관리자 계정(이태규) 존재.

---

## 설계 결정 (MVP)
- **결재선 = 역할:** 별도 결재선 화면 없이, 관리자가 직원의 역할을 `approver`로 올리면 그 사람이 승인 대기함을 처리한다. (공유 승인함 모델과 일치)
- **계정 발급:** 관리자가 이메일·임시비밀번호·이름·역할·소속을 입력 → auth 사용자 생성 + `users` 프로필 생성. 직원은 받은 임시비밀번호로 로그인.
- **비밀번호 재설정 UI는 범위 밖**(YAGNI): 필요 시 Supabase 대시보드에서 처리. 활성/비활성 토글로 접근 통제.
- **삭제 대신 비활성화:** 계정/항목 모두 hard delete 미제공, `is_active` 토글.

## File Structure
```
src/
├─ lib/supabase/admin.ts        # service_role 서버 전용 클라이언트
├─ lib/admin/actions.ts         # createEmployee/setActive/setRole/addItem/setItemActive
├─ app/(app)/admin/
│  ├─ layout.tsx                # admin 가드 + 탭
│  ├─ page.tsx                  # /admin → /admin/employees 리다이렉트
│  ├─ employees/page.tsx        # 직원 목록 + 발급/역할/활성
│  ├─ employees/new-employee.tsx# 계정 발급 폼 (client)
│  ├─ employees/employee-row.tsx# 역할/활성 인라인 조작 (client)
│  └─ items/page.tsx            # 복지 항목 목록 + 추가/활성
└─ app/(app)/admin/items/item-form.tsx  # 항목 추가 폼 (client)
```

---

## Task 1: service_role 키 + admin 클라이언트

> **외부 준비물:** 실행자/사용자는 Supabase 대시보드 → Project Settings → API → **`service_role` (secret) 키**를 복사해 `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY=`에 넣는다. 이 키는 모든 RLS를 우회하므로 **서버에서만** 쓰며 절대 클라이언트로 노출하지 않는다. (`.env.local`은 gitignore됨)

**Files:**
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: `.env.local`에 service_role 키 채우기** (사용자 작업)

`.env.local`의 `SUPABASE_SERVICE_ROLE_KEY=` 뒤에 키를 붙여넣는다.

- [ ] **Step 2: admin 클라이언트 작성**

`src/lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

/** service_role 키를 쓰는 서버 전용 클라이언트. RLS 우회 — 서버 액션 내부에서만 사용. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공(키가 비어 있어도 빌드는 통과 — 런타임에만 필요).

- [ ] **Step 4: Commit**
```bash
git add src/lib/supabase/admin.ts
git commit -m "feat: add service-role admin Supabase client"
```

---

## Task 2: 관리자 서버 액션

**Files:**
- Create: `src/lib/admin/actions.ts`

- [ ] **Step 1: 작성**

`src/lib/admin/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canAdmin, type Role } from "@/lib/roles";

async function assertAdmin() {
  const user = await requireUser();
  if (!canAdmin(user.role)) throw new Error("관리자 권한이 필요합니다.");
  return user;
}

/** 직원 계정 발급: auth 사용자 + 프로필 생성 */
export async function createEmployee(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;
  const department = String(formData.get("department") ?? "").trim() || null;

  if (!email) throw new Error("이메일을 입력하세요.");
  if (password.length < 6) throw new Error("임시 비밀번호는 6자 이상이어야 합니다.");
  if (!name) throw new Error("이름을 입력하세요.");

  const admin = createAdminClient();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`계정 생성 실패: ${cErr?.message ?? "알 수 없음"}`);

  const { error: pErr } = await admin
    .from("users")
    .insert({ id: created.user.id, email, name, role, department });
  if (pErr) {
    // 프로필 생성 실패 시 방금 만든 auth 사용자 롤백
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error("프로필 생성 실패. 다시 시도하세요.");
  }
  revalidatePath("/admin/employees");
}

/** 직원 활성/비활성 토글 */
export async function setEmployeeActive(userId: string, isActive: boolean) {
  await assertAdmin();
  const supabase = await createClient(); // 관리자 세션 + RLS(users_admin_all)
  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);
  if (error) throw new Error("상태 변경 실패");
  revalidatePath("/admin/employees");
}

/** 직원 역할 변경 (결재선 = approver 부여) */
export async function setEmployeeRole(userId: string, role: Role) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) throw new Error("역할 변경 실패");
  revalidatePath("/admin/employees");
}

/** 복지 항목 추가 */
export async function addWelfareItem(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const limitRaw = String(formData.get("monthly_limit") ?? "").trim();
  const monthly_limit = limitRaw ? Number(limitRaw) : null;
  if (!name) throw new Error("항목명을 입력하세요.");
  if (monthly_limit !== null && (!Number.isInteger(monthly_limit) || monthly_limit < 0))
    throw new Error("한도를 올바르게 입력하세요.");

  const supabase = await createClient();
  const { error } = await supabase.from("welfare_items").insert({ name, monthly_limit });
  if (error) throw new Error("항목 추가 실패");
  revalidatePath("/admin/items");
}

/** 복지 항목 활성/비활성 토글 */
export async function setWelfareItemActive(itemId: string, isActive: boolean) {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("welfare_items").update({ is_active: isActive }).eq("id", itemId);
  if (error) throw new Error("상태 변경 실패");
  revalidatePath("/admin/items");
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add src/lib/admin/actions.ts
git commit -m "feat: add admin server actions for employees and items"
```

---

## Task 3: 관리자 레이아웃 (가드 + 탭)

**Files:**
- Create: `src/app/(app)/admin/layout.tsx`, `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: 레이아웃 (admin 가드 + 탭)**

`src/app/(app)/admin/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canAdmin(user.role)) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자</h1>
        <nav className="mt-3 flex gap-4 border-b">
          <Link href="/admin/employees" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">직원/계정</Link>
          <Link href="/admin/items" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 항목</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: /admin 리다이렉트**

`src/app/(app)/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/employees");
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/admin/layout.tsx src/app/\(app\)/admin/page.tsx
git commit -m "feat: add admin layout with guard and tabs"
```

---

## Task 4: 직원 계정 관리 (/admin/employees)

**Files:**
- Create: `src/app/(app)/admin/employees/new-employee.tsx`, `src/app/(app)/admin/employees/employee-row.tsx`, `src/app/(app)/admin/employees/page.tsx`

- [ ] **Step 1: 계정 발급 폼 (client)**

`src/app/(app)/admin/employees/new-employee.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createEmployee } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewEmployee() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null); setOk(false); setPending(true);
    try {
      await createEmployee(formData);
      setOk(true);
      (document.getElementById("emp-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="emp-form" action={action} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">임시 비밀번호 (6자+)</Label>
        <Input id="password" name="password" minLength={6} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="department">소속 (선택)</Label>
        <Input id="department" name="department" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">역할</Label>
        <select id="role" name="role" className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="staff">직원</option>
          <option value="approver">결재자</option>
          <option value="admin">관리자</option>
        </select>
      </div>
      <div className="flex items-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "발급 중..." : "계정 발급"}</Button>
        {ok && <span className="text-sm text-green-600">발급 완료</span>}
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: 역할/활성 인라인 조작 (client)**

`src/app/(app)/admin/employees/employee-row.tsx`:
```tsx
"use client";

import { useState } from "react";
import { setEmployeeActive, setEmployeeRole } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles";

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [busy, setBusy] = useState(false);
  return (
    <select
      defaultValue={role}
      disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => {
        setBusy(true);
        await setEmployeeRole(userId, e.target.value as Role);
        setBusy(false);
      }}
    >
      <option value="staff">직원</option>
      <option value="approver">결재자</option>
      <option value="admin">관리자</option>
    </select>
  );
}

export function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "destructive"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setEmployeeActive(userId, !isActive);
        setBusy(false);
      }}
    >
      {isActive ? "비활성화" : "활성화"}
    </Button>
  );
}
```

- [ ] **Step 3: 직원 목록 페이지 (server)**

`src/app/(app)/admin/employees/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { NewEmployee } from "./new-employee";
import { RoleSelect, ActiveToggle } from "./employee-row";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/roles";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, department, is_active")
    .order("created_at");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>새 직원 계정 발급</CardTitle></CardHeader>
        <CardContent><NewEmployee /></CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">직원 목록</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead><TableHead>이메일</TableHead>
              <TableHead>소속</TableHead><TableHead>역할</TableHead>
              <TableHead>상태</TableHead><TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.department ?? "-"}</TableCell>
                <TableCell><RoleSelect userId={u.id} role={u.role as Role} /></TableCell>
                <TableCell>
                  {u.is_active ? <Badge>활성</Badge> : <Badge variant="destructive">비활성</Badge>}
                </TableCell>
                <TableCell><ActiveToggle userId={u.id} isActive={u.is_active} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/admin/employees` 라우트 생성)

- [ ] **Step 5: Commit**
```bash
git add src/app/\(app\)/admin/employees/
git commit -m "feat: add employee account management page"
```

---

## Task 5: 복지 항목 관리 (/admin/items)

**Files:**
- Create: `src/app/(app)/admin/items/item-form.tsx`, `src/app/(app)/admin/items/item-toggle.tsx`, `src/app/(app)/admin/items/page.tsx`

- [ ] **Step 1: 항목 추가 폼 (client)**

`src/app/(app)/admin/items/item-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { addWelfareItem } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ItemForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setError(null); setPending(true);
    try {
      await addWelfareItem(formData);
      (document.getElementById("item-form") as HTMLFormElement)?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="item-form" action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="name">항목명</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="monthly_limit">월 한도 (원, 선택)</Label>
        <Input id="monthly_limit" name="monthly_limit" type="number" min="0" placeholder="무제한" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "추가 중..." : "항목 추가"}</Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: 항목 활성 토글 (client)**

`src/app/(app)/admin/items/item-toggle.tsx`:
```tsx
"use client";

import { useState } from "react";
import { setWelfareItemActive } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

export function ItemToggle({ itemId, isActive }: { itemId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "destructive"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setWelfareItemActive(itemId, !isActive);
        setBusy(false);
      }}
    >
      {isActive ? "비활성화" : "활성화"}
    </Button>
  );
}
```

- [ ] **Step 3: 항목 목록 페이지 (server)**

`src/app/(app)/admin/items/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "./item-form";
import { ItemToggle } from "./item-toggle";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function ItemsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("welfare_items")
    .select("id, name, monthly_limit, is_active")
    .order("created_at");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>복지 항목 추가</CardTitle></CardHeader>
        <CardContent><ItemForm /></CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">복지 항목 목록</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>항목명</TableHead><TableHead>월 한도</TableHead>
              <TableHead>상태</TableHead><TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.name}</TableCell>
                <TableCell>{it.monthly_limit ? `${it.monthly_limit.toLocaleString()}원` : "무제한"}</TableCell>
                <TableCell>
                  {it.is_active ? <Badge>활성</Badge> : <Badge variant="destructive">비활성</Badge>}
                </TableCell>
                <TableCell><ItemToggle itemId={it.id} isActive={it.is_active} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공. (`/admin/items` 라우트 생성)

- [ ] **Step 5: Commit**
```bash
git add src/app/\(app\)/admin/items/
git commit -m "feat: add welfare item management page"
```

---

## Task 6: 전체 검증 + 수동 E2E

- [ ] **Step 1: 단위 테스트 + 빌드**
```bash
npm test && npm run build
```
Expected: 기존 12개 PASS, 빌드 성공. 라우트 `/admin`, `/admin/employees`, `/admin/items` 생성.

- [ ] **Step 2: 수동 E2E (dev 서버, service_role 키 설정 후)**
```bash
npm run dev
```
관리자(이태규)로 로그인 후:
1. **관리자 → 복지 항목**: 새 항목 추가 → 목록에 표시, 비활성화 토글 동작
2. **관리자 → 직원/계정**: 새 직원 발급(이름·이메일·임시비번·역할=결재자) → 목록에 추가
3. 발급한 결재자 계정으로 (시크릿 창에서) 로그인 → 사이드바에 **승인 대기함** 보이고 **관리자** 안 보이는지
4. 그 결재자로 복지 청구 승인 처리 → 정상 동작(권한 분리 확인)
5. 직원 역할 인라인 변경·활성/비활성 토글 동작 확인

Expected: 위 흐름 동작. (이 단계로 직원/결재자 권한 분리 운영이 처음으로 실제 검증된다)

> service_role 키가 `.env.local`에 없으면 "계정 발급"만 런타임 에러가 난다(복지항목·역할변경은 정상). 키 설정 후 dev 서버 재시작.

---

## Self-Review 결과 (작성자 점검)
- **스펙 커버리지:** 직원 계정 발급(역할·소속) ✓, 활성/비활성 ✓, 역할 변경=결재선 ✓, 복지항목 추가·비활성 ✓, admin 가드(layout redirect + 서버액션 assertAdmin + RLS 3중) ✓.
- **플레이스홀더:** 없음. 모든 코드 스텝에 실제 코드.
- **타입 일관성:** `Role`은 roles.ts 정의 재사용(폼·RoleSelect·액션). createEmployee 실패 시 auth 사용자 롤백 처리.
- **보안:** service_role 클라이언트는 `src/lib/supabase/admin.ts` 서버 모듈에서만 import. 클라이언트 컴포넌트는 서버 액션만 호출. `.env.local` gitignore 확인됨.

---

## 1차 MVP + 운영 준비 완료 후 다음
- **2차:** 연차 청구·승인(잔여 연차 자동계산), 건의사항·댓글
- **3차:** PWA(휴대폰 설치)·푸시 알림, 네이티브 앱
- 운영: 첫 비밀번호 변경 안내, 백업/모니터링(Supabase 어드바이저 정기 점검)
