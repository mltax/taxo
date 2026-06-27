# 연차 결재 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원이 연차/반차를 신청하면 직속 결재자가 1단계로 승인/반려하고, 입사일·한국법 기준으로 연초에 자동 부여된 연차에서 차감·잔여를 관리하는 시스템.

**Architecture:** 기존 taxo(Next.js 16 + Supabase) 위에 구축. 조직 계층은 각 직원의 `approver_id`(직속 결재자)로 표현하고, 결재는 그 1명에게 라우팅. 연차 계산(법정 부여·일수)은 순수 함수로 분리해 TDD. 관리(팀·입사일·부여)는 HR 권한(`hr_manager`/`admin`) 화면. 권한은 RLS로 강제.

**Tech Stack:** Next.js 16(App Router, Server Actions), Supabase(Postgres·RLS), shadcn/ui, Vitest

**전제(완료됨):** `users`(role enum staff/approver/admin), `requireUser`, `canApprove`, `canAdmin`, Supabase 서버 클라이언트, 관리자 계정(이태규=admin). Supabase 프로젝트 ref `ganihzhdyazowrhmsttl`(서울). 마이그레이션은 MCP `apply_migration`으로 적용.

---

## 설계 결정 요약 (spec 기준)
- 4단계: 팀원(staff) → 팀장(approver) → 인사관리자(hr_manager, 신규) → 대표(admin)
- 결재: 신청자의 `approver_id` 1명에게 라우팅, 1번 승인으로 완료
- 권한: `canApprove`=approver/hr_manager/admin, `canManageHR`=hr_manager/admin(신규), `canAdmin`=admin
- 연차: `computeLegalLeave(hireDate, year)` 자동 + 관리자 개별 수정. 종일/반차(0.5), 평일 카운트

## File Structure
```
src/
├─ lib/
│  ├─ roles.ts                 # (수정) hr_manager, canManageHR, nav 추가
│  └─ leave/
│     ├─ calc.ts               # computeLegalLeave, countLeaveDays (순수, TDD)
│     ├─ types.ts              # LeaveRequest/Team/Grant 타입, 상태 라벨
│     └─ actions.ts            # submit/approve/reject (신청자·결재자)
│  └─ hr/
│     └─ actions.ts            # team/approver/hire_date/grant 관리
├─ app/(app)/
│  ├─ leave/page.tsx           # 연차 신청 + 내 현황/내역
│  ├─ leave/leave-form.tsx     # 신청 폼(client)
│  ├─ leave/inbox/page.tsx     # 결재자 승인함
│  ├─ leave/inbox/leave-actions.tsx
│  └─ admin/
│     ├─ teams/page.tsx        # 팀 관리
│     ├─ teams/team-forms.tsx
│     ├─ leave/page.tsx        # 입사일·연차부여 관리
│     └─ leave/leave-admin.tsx
supabase/migrations/
├─ 0006_user_role_hr.sql
├─ 0007_leave_schema.sql
└─ 0008_leave_rls.sql
tests/
├─ leave-calc.test.ts
└─ roles.test.ts              # (보강)
```

---

## Task 1: user_role enum에 hr_manager 추가

> enum 값 추가는 단독 마이그레이션으로(같은 트랜잭션에서 사용 금지).

**Files:** Create `supabase/migrations/0006_user_role_hr.sql`

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0006_user_role_hr.sql`:
```sql
alter type user_role add value if not exists 'hr_manager';
```

- [ ] **Step 2: 적용** — Supabase MCP `apply_migration`(name `user_role_hr`).
Expected: 성공. 확인: `select unnest(enum_range(null::user_role));` → staff, approver, admin, hr_manager.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0006_user_role_hr.sql
git commit -m "feat: add hr_manager role value"
```

---

## Task 2: 스키마 — users 컬럼 + teams + leave 테이블

**Files:** Create `supabase/migrations/0007_leave_schema.sql`

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0007_leave_schema.sql`:
```sql
-- 팀
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- users 확장
alter table public.users
  add column hire_date date,
  add column team_id uuid references public.teams(id),
  add column approver_id uuid references public.users(id);

-- 연차 상태
create type leave_status as enum ('pending', 'approved', 'rejected');

-- 연도별 부여 연차
create table public.leave_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  year integer not null,
  granted_days numeric(4,1) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

-- 연차 신청
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null check (days > 0),
  half_day boolean not null default false,
  reason text not null default '',
  status leave_status not null default 'pending',
  approver_id uuid references public.users(id),
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: 적용** — MCP `apply_migration`(name `leave_schema`).
Expected: 성공. 확인: `select count(*) from public.teams;` → 0; `\d public.users` 에 hire_date/team_id/approver_id 존재.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0007_leave_schema.sql
git commit -m "feat: add teams, leave_grants, leave_requests schema"
```

---

## Task 3: RLS 정책 + is_hr() 헬퍼

**Files:** Create `supabase/migrations/0008_leave_rls.sql`

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0008_leave_rls.sql`:
```sql
-- HR 권한 헬퍼
create or replace function public.is_hr()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('hr_manager','admin');
$$;
revoke execute on function public.is_hr() from public;
revoke execute on function public.is_hr() from anon;
grant execute on function public.is_hr() to authenticated;

alter table public.teams enable row level security;
alter table public.leave_grants enable row level security;
alter table public.leave_requests enable row level security;

-- teams: 인증 조회, HR 작성
create policy teams_select on public.teams
  for select using (auth.uid() is not null);
create policy teams_hr_write on public.teams
  for all using (public.is_hr()) with check (public.is_hr());

-- leave_grants: 본인 또는 HR 조회, HR 작성
create policy grants_select on public.leave_grants
  for select using (user_id = auth.uid() or public.is_hr());
create policy grants_hr_write on public.leave_grants
  for all using (public.is_hr()) with check (public.is_hr());

-- leave_requests
create policy leave_select on public.leave_requests
  for select using (
    user_id = auth.uid() or approver_id = auth.uid() or public.is_hr()
  );
create policy leave_insert_self on public.leave_requests
  for insert with check (user_id = auth.uid());
create policy leave_update on public.leave_requests
  for update using (approver_id = auth.uid() or public.is_hr());

-- users: HR 도 전체 조회/수정 가능 (팀·결재자·입사일 관리)
create policy users_hr_select on public.users
  for select using (public.is_hr());
create policy users_hr_update on public.users
  for update using (public.is_hr()) with check (public.is_hr());
```

- [ ] **Step 2: 적용** — MCP `apply_migration`(name `leave_rls`). 그 후 보안 어드바이저 점검(`get_advisors security`) — is_hr는 authenticated만 실행되므로 anon 경고 없어야 함.
Expected: 성공, 신규 anon 보안 경고 없음.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0008_leave_rls.sql
git commit -m "feat: add RLS for teams and leave tables"
```

---

## Task 4: roles.ts 확장 (hr_manager, canManageHR, nav) — TDD

**Files:** Modify `src/lib/roles.ts`; Modify `tests/roles.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`tests/roles.test.ts` 의 `describe("roles", ...)` 안에 다음 테스트를 추가:
```ts
  it("hr_manager and admin can manage HR; others cannot", () => {
    expect(canManageHR("staff")).toBe(false);
    expect(canManageHR("approver")).toBe(false);
    expect(canManageHR("hr_manager")).toBe(true);
    expect(canManageHR("admin")).toBe(true);
  });

  it("hr_manager can approve", () => {
    expect(canApprove("hr_manager")).toBe(true);
  });

  it("staff sees 연차 but not 연차 승인함/인사", () => {
    const labels = navItemsForRole("staff").map((i) => i.label);
    expect(labels).toContain("연차");
    expect(labels).not.toContain("연차 승인함");
    expect(labels).not.toContain("인사");
  });

  it("approver sees 연차 승인함 but not 인사", () => {
    const labels = navItemsForRole("approver").map((i) => i.label);
    expect(labels).toContain("연차 승인함");
    expect(labels).not.toContain("인사");
  });

  it("hr_manager sees 인사", () => {
    expect(navItemsForRole("hr_manager").map((i) => i.label)).toContain("인사");
  });
```
그리고 import 줄에 `canManageHR` 추가:
```ts
import { canApprove, canAdmin, canManageHR, navItemsForRole, type Role } from "@/lib/roles";
```

- [ ] **Step 2: 실패 확인**
```bash
npm test -- roles
```
Expected: FAIL (canManageHR 없음).

- [ ] **Step 3: roles.ts 수정**

`src/lib/roles.ts` 전체를 교체:
```ts
export type Role = "staff" | "approver" | "hr_manager" | "admin";

export interface NavItem {
  label: string;
  href: string;
}

export function canApprove(role: Role): boolean {
  return role === "approver" || role === "hr_manager" || role === "admin";
}

export function canManageHR(role: Role): boolean {
  return role === "hr_manager" || role === "admin";
}

export function canAdmin(role: Role): boolean {
  return role === "admin";
}

export function navItemsForRole(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "복지 청구", href: "/welfare" },
    { label: "자료실", href: "/board" },
    { label: "연차", href: "/leave" },
  ];
  if (canApprove(role)) {
    items.push({ label: "승인 대기함", href: "/welfare/inbox" });
    items.push({ label: "연차 승인함", href: "/leave/inbox" });
  }
  if (canManageHR(role)) {
    items.push({ label: "인사", href: "/admin/teams" });
  }
  if (canAdmin(role)) {
    items.push({ label: "관리자", href: "/admin/employees" });
  }
  return items;
}
```

- [ ] **Step 4: 통과 확인**
```bash
npm test -- roles
```
Expected: PASS (기존 + 신규 테스트).

- [ ] **Step 5: Commit**
```bash
git add src/lib/roles.ts tests/roles.test.ts
git commit -m "feat: add hr_manager role and HR/leave nav items"
```

---

## Task 5: 연차 계산 순수 함수 (TDD)

**Files:** Create `src/lib/leave/calc.ts`; Test `tests/leave-calc.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/leave-calc.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeLegalLeave, countLeaveDays } from "@/lib/leave/calc";

describe("computeLegalLeave (입사일·한국법, 대상연도 1/1 기준)", () => {
  it("만 1년·2년 = 15일", () => {
    expect(computeLegalLeave("2025-01-01", 2026)).toBe(15); // 1년
    expect(computeLegalLeave("2024-01-01", 2026)).toBe(15); // 2년
  });
  it("3·4년 = 16, 5·6년 = 17", () => {
    expect(computeLegalLeave("2023-01-01", 2026)).toBe(16); // 3년
    expect(computeLegalLeave("2022-01-01", 2026)).toBe(16); // 4년
    expect(computeLegalLeave("2021-01-01", 2026)).toBe(17); // 5년
  });
  it("한도 25일", () => {
    expect(computeLegalLeave("2000-01-01", 2026)).toBe(25);
  });
  it("1년 미만(작년 입사) = 완성 개월수, 최대 11", () => {
    expect(computeLegalLeave("2025-07-01", 2026)).toBe(6);  // 7~12월=6개월
    expect(computeLegalLeave("2025-02-01", 2026)).toBe(11); // 11개월→11 한도
  });
  it("대상연도에 입사(미입사) = 0", () => {
    expect(computeLegalLeave("2026-03-01", 2026)).toBe(0);
  });
});

describe("countLeaveDays", () => {
  it("반차 = 0.5", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-01", true)).toBe(0.5);
  });
  it("단일 평일 = 1", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-01", false)).toBe(1); // 월요일
  });
  it("주말 제외 평일 카운트", () => {
    // 2026-06-01(월)~06-05(금)=5, 06-06(토)·07(일) 제외
    expect(countLeaveDays("2026-06-01", "2026-06-07", false)).toBe(5);
  });
  it("토~일 구간 = 0", () => {
    expect(countLeaveDays("2026-06-06", "2026-06-07", false)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**
```bash
npm test -- leave-calc
```
Expected: FAIL (모듈 없음).

- [ ] **Step 3: 구현**

`src/lib/leave/calc.ts`:
```ts
/** 입사일(YYYY-MM-DD)과 대상 연도로 법정 연차 일수를 계산. 대상연도 1/1 기준 완성 근속. */
export function computeLegalLeave(hireDate: string, targetYear: number): number {
  const hire = new Date(hireDate + "T00:00:00Z");
  const jan1 = new Date(Date.UTC(targetYear, 0, 1));

  // 완성 개월수 (1/1 기준)
  const months =
    (jan1.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
    (jan1.getUTCMonth() - hire.getUTCMonth()) -
    (jan1.getUTCDate() < hire.getUTCDate() ? 1 : 0);

  if (months <= 0) return 0; // 대상연도 입사/미입사
  if (months < 12) return Math.min(11, months); // 1년 미만: 월 1일, 한도 11

  const years = Math.floor(months / 12);
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}

/** 연차 사용 일수. 반차면 0.5, 아니면 start~end 평일(월~금) 수. */
export function countLeaveDays(start: string, end: string, halfDay: boolean): number {
  if (halfDay) return 0.5;
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  let count = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay(); // 0=일,6=토
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
```

- [ ] **Step 4: 통과 확인**
```bash
npm test -- leave-calc
```
Expected: PASS (9 passed).

- [ ] **Step 5: Commit**
```bash
git add src/lib/leave/calc.ts tests/leave-calc.test.ts
git commit -m "feat: add leave calculation pure functions with tests"
```

---

## Task 6: 연차 타입 + 상태 라벨

**Files:** Create `src/lib/leave/types.ts`

- [ ] **Step 1: 작성**

`src/lib/leave/types.ts`:
```ts
export type LeaveStatus = "pending" | "approved" | "rejected";

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려됨",
};

export interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  half_day: boolean;
  reason: string;
  status: LeaveStatus;
  approver_id: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/leave/types.ts
git commit -m "feat: add leave types and status labels"
```

---

## Task 7: 연차 신청자/결재자 서버 액션

**Files:** Create `src/lib/leave/actions.ts`

- [ ] **Step 1: 작성**

`src/lib/leave/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/roles";
import { countLeaveDays } from "@/lib/leave/calc";

/** 직원: 연차/반차 신청 (직속 결재자에게 라우팅) */
export async function submitLeave(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const start = String(formData.get("start_date") ?? "");
  const halfDay = formData.get("half_day") === "on";
  const end = halfDay ? start : String(formData.get("end_date") ?? start);
  const reason = String(formData.get("reason") ?? "").trim();

  if (!start) throw new Error("시작일을 선택하세요.");
  if (new Date(end) < new Date(start)) throw new Error("종료일이 시작일보다 빠릅니다.");

  // 직속 결재자 확인
  const { data: me } = await supabase
    .from("users")
    .select("approver_id")
    .eq("id", user.id)
    .single();
  if (!me?.approver_id) {
    throw new Error("직속 결재자가 지정되지 않았습니다. 관리자에게 문의하세요.");
  }

  const days = countLeaveDays(start, end, halfDay);
  if (days <= 0) throw new Error("신청 일수가 0일입니다. 평일을 선택하세요.");

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: start,
    end_date: end,
    days,
    half_day: halfDay,
    reason,
    approver_id: me.approver_id,
  });
  if (error) throw new Error("신청 저장에 실패했습니다.");
  revalidatePath("/leave");
}

/** 결재자: 승인 */
export async function approveLeave(id: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("승인 권한이 없습니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("승인 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}

/** 결재자: 반려 (사유 필수) */
export async function rejectLeave(id: string, reason: string) {
  const user = await requireUser();
  if (!canApprove(user.role)) throw new Error("반려 권한이 없습니다.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("반려 사유를 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "rejected", reject_reason: trimmed })
    .eq("id", id)
    .eq("approver_id", user.id)
    .eq("status", "pending");
  if (error) throw new Error("반려 처리에 실패했습니다.");
  revalidatePath("/leave/inbox");
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 성공.

- [ ] **Step 3: Commit**
```bash
git add src/lib/leave/actions.ts
git commit -m "feat: add leave request server actions"
```

---

## Task 8: HR 관리 서버 액션 (팀·결재자·입사일·부여)

**Files:** Create `src/lib/hr/actions.ts`

- [ ] **Step 1: 작성**

`src/lib/hr/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { canManageHR, type Role } from "@/lib/roles";
import { computeLegalLeave } from "@/lib/leave/calc";

async function assertHR() {
  const user = await requireUser();
  if (!canManageHR(user.role)) throw new Error("인사 관리 권한이 필요합니다.");
}

/** 팀 생성 */
export async function createTeam(formData: FormData) {
  await assertHR();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("팀 이름을 입력하세요.");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name });
  if (error) throw new Error("팀 생성 실패");
  revalidatePath("/admin/teams");
}

/** 팀장 지정 */
export async function setTeamLeader(teamId: string, leaderId: string | null) {
  await assertHR();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ leader_id: leaderId })
    .eq("id", teamId);
  if (error) throw new Error("팀장 지정 실패");
  revalidatePath("/admin/teams");
}

/** 직원의 팀 배정 (+직속 결재자를 팀장으로 기본 설정) */
export async function assignEmployeeTeam(userId: string, teamId: string | null) {
  await assertHR();
  const supabase = await createClient();
  let approverId: string | null = null;
  if (teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("leader_id")
      .eq("id", teamId)
      .single();
    approverId = team?.leader_id ?? null;
  }
  const { error } = await supabase
    .from("users")
    .update({ team_id: teamId, approver_id: approverId })
    .eq("id", userId);
  if (error) throw new Error("팀 배정 실패");
  revalidatePath("/admin/teams");
}

/** 직속 결재자 수동 지정 (팀장·인사관리자용) */
export async function setApprover(userId: string, approverId: string | null) {
  await assertHR();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ approver_id: approverId })
    .eq("id", userId);
  if (error) throw new Error("결재자 지정 실패");
  revalidatePath("/admin/teams");
}

/** 입사일 설정 */
export async function setHireDate(userId: string, hireDate: string) {
  await assertHR();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ hire_date: hireDate || null })
    .eq("id", userId);
  if (error) throw new Error("입사일 설정 실패");
  revalidatePath("/admin/leave");
}

/** 연차 일괄 산정: 입사일 있는 전 직원에 대해 해당 연도 부여행 생성(없을 때만) */
export async function generateGrants(year: number) {
  await assertHR();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, hire_date")
    .not("hire_date", "is", null);

  const { data: existing } = await supabase
    .from("leave_grants")
    .select("user_id")
    .eq("year", year);
  const has = new Set((existing ?? []).map((g) => g.user_id));

  const rows = (users ?? [])
    .filter((u) => !has.has(u.id) && u.hire_date)
    .map((u) => ({
      user_id: u.id,
      year,
      granted_days: computeLegalLeave(u.hire_date as string, year),
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("leave_grants").insert(rows);
    if (error) throw new Error("연차 일괄 산정 실패");
  }
  revalidatePath("/admin/leave");
}

/** 개별 부여일수 수정 (upsert) */
export async function setGrant(userId: string, year: number, days: number) {
  await assertHR();
  if (days < 0) throw new Error("부여일수는 0 이상이어야 합니다.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_grants")
    .upsert({ user_id: userId, year, granted_days: days }, { onConflict: "user_id,year" });
  if (error) throw new Error("부여일수 수정 실패");
  revalidatePath("/admin/leave");
}

export type { Role };
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 성공.

- [ ] **Step 3: Commit**
```bash
git add src/lib/hr/actions.ts
git commit -m "feat: add HR management server actions"
```

---

## Task 9: 연차 신청 폼 (client)

**Files:** Create `src/app/(app)/leave/leave-form.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/leave/leave-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { submitLeave } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LeaveForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [halfDay, setHalfDay] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await submitLeave(formData);
      (document.getElementById("leave-form") as HTMLFormElement)?.reset();
      setHalfDay(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="leave-form" action={action} className="space-y-4 max-w-md">
      <div className="flex items-center gap-2">
        <input
          id="half_day"
          name="half_day"
          type="checkbox"
          className="h-4 w-4"
          checked={halfDay}
          onChange={(e) => setHalfDay(e.target.checked)}
        />
        <Label htmlFor="half_day">반차 (0.5일)</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="start_date">{halfDay ? "날짜" : "시작일"}</Label>
        <Input id="start_date" name="start_date" type="date" required />
      </div>
      {!halfDay && (
        <div className="space-y-2">
          <Label htmlFor="end_date">종료일</Label>
          <Input id="end_date" name="end_date" type="date" required />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="reason">사유</Label>
        <Input id="reason" name="reason" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "제출 중..." : "연차 신청"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/\(app\)/leave/leave-form.tsx
git commit -m "feat: add leave request form"
```

---

## Task 10: 연차 페이지 — 신청 + 내 현황/내역

**Files:** Create `src/app/(app)/leave/page.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/leave/page.tsx`:
```tsx
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveForm } from "./leave-form";
import { LEAVE_STATUS_LABEL, type LeaveStatus } from "@/lib/leave/types";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeavePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [grantRes, reqRes] = await Promise.all([
    supabase
      .from("leave_grants")
      .select("granted_days")
      .eq("user_id", user.id)
      .eq("year", year)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, days, half_day, status, reason, reject_reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const granted = grantRes.data?.granted_days ?? 0;
  const requests = reqRes.data ?? [];
  const used = requests
    .filter((r) => r.status === "approved" && r.start_date.startsWith(String(year)))
    .reduce((sum, r) => sum + Number(r.days), 0);
  const remaining = Number(granted) - used;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold">연차</h1>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">{year}년 부여</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{granted}일</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">사용</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{used}일</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">잔여</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{remaining}일</CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>연차 신청</CardTitle></CardHeader>
          <CardContent><LeaveForm /></CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">내 신청 내역</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>기간</TableHead><TableHead>일수</TableHead>
              <TableHead>사유</TableHead><TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.start_date}{!r.half_day && r.end_date !== r.start_date ? ` ~ ${r.end_date}` : ""}
                  {r.half_day ? " (반차)" : ""}
                </TableCell>
                <TableCell>{Number(r.days)}일</TableCell>
                <TableCell>
                  {r.reason}
                  {r.status === "rejected" && r.reject_reason && (
                    <span className="block text-xs text-destructive">반려: {r.reject_reason}</span>
                  )}
                </TableCell>
                <TableCell><Badge variant={r.status === "rejected" ? "destructive" : r.status === "approved" ? "default" : "secondary"}>{LEAVE_STATUS_LABEL[r.status as LeaveStatus]}</Badge></TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">신청 내역이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**
```bash
npm run build
```
Expected: 성공. `/leave` 라우트 생성.

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/leave/page.tsx
git commit -m "feat: add leave page with balance and history"
```

---

## Task 11: 연차 승인함 (결재자)

**Files:** Create `src/app/(app)/leave/inbox/leave-actions.tsx`, `src/app/(app)/leave/inbox/page.tsx`

- [ ] **Step 1: 행동 버튼 (client)**

`src/app/(app)/leave/inbox/leave-actions.tsx`:
```tsx
"use client";

import { useState } from "react";
import { approveLeave, rejectLeave } from "@/lib/leave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LeaveActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (rejecting) {
    return (
      <div className="flex gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유" className="h-8" />
        <Button size="sm" variant="destructive" disabled={busy || !reason.trim()}
          onClick={async () => { setBusy(true); await rejectLeave(id, reason); setBusy(false); }}>확인</Button>
        <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>취소</Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await approveLeave(id); setBusy(false); }}>승인</Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting(true)}>반려</Button>
    </div>
  );
}
```

- [ ] **Step 2: 페이지 (server, 권한 가드)**

`src/app/(app)/leave/inbox/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canApprove } from "@/lib/roles";
import { LeaveActions } from "./leave-actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeaveInboxPage() {
  const user = await requireUser();
  if (!canApprove(user.role)) redirect("/dashboard");
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, days, half_day, reason, users:user_id(name)")
    .eq("approver_id", user.id)
    .eq("status", "pending")
    .order("created_at");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">연차 승인함</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>신청자</TableHead><TableHead>기간</TableHead>
            <TableHead>일수</TableHead><TableHead>사유</TableHead><TableHead>처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(pending ?? []).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell>{r.users?.name ?? "-"}</TableCell>
              <TableCell>
                {r.start_date}{!r.half_day && r.end_date !== r.start_date ? ` ~ ${r.end_date}` : ""}
                {r.half_day ? " (반차)" : ""}
              </TableCell>
              <TableCell>{Number(r.days)}일</TableCell>
              <TableCell>{r.reason}</TableCell>
              <TableCell><LeaveActions id={r.id} /></TableCell>
            </TableRow>
          ))}
          {(pending ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">대기 중인 신청이 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 성공. `/leave/inbox` 라우트 생성.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/leave/inbox/
git commit -m "feat: add leave approver inbox"
```

---

## Task 12: 관리자 레이아웃 탭 확장 + 가드 조정

기존 `/admin` 레이아웃은 `canAdmin`(대표)만 접근. HR 화면은 `canManageHR`(인사관리자+대표)도 접근해야 하므로 가드와 탭을 조정한다.

**Files:** Modify `src/app/(app)/admin/layout.tsx`

- [ ] **Step 1: 레이아웃 수정**

`src/app/(app)/admin/layout.tsx` 전체를 교체:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canManageHR, canAdmin } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canManageHR(user.role)) redirect("/dashboard");
  const isAdmin = canAdmin(user.role);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "관리자" : "인사 관리"}</h1>
        <nav className="mt-3 flex flex-wrap gap-4 border-b">
          <Link href="/admin/teams" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">팀</Link>
          <Link href="/admin/leave" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">연차 관리</Link>
          {isAdmin && (
            <>
              <Link href="/admin/employees" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">직원/계정</Link>
              <Link href="/admin/items" className="pb-2 text-sm hover:border-b-2 hover:border-foreground">복지 항목</Link>
            </>
          )}
        </nav>
      </div>
      {children}
    </div>
  );
}
```

> 참고: 기존 `/admin/page.tsx`(→/admin/employees 리다이렉트)는 대표 전용 페이지로 유지. 인사관리자는 nav의 "인사"가 `/admin/teams`를 직접 가리키므로 영향 없음. `/admin/employees`·`/admin/items` 페이지는 `canAdmin` 직원만 nav 노출되지만, 페이지 자체 가드는 레이아웃이 canManageHR라 인사관리자도 URL 접근 가능 → 두 페이지 상단에 대표 전용 가드를 추가한다(Step 2).

- [ ] **Step 2: 대표 전용 페이지에 가드 추가**

`src/app/(app)/admin/employees/page.tsx` 의 컴포넌트 함수 본문 맨 앞(`const supabase = await createClient();` 위)에 추가:
```tsx
  const me = await requireUser();
  if (!canAdmin(me.role)) redirect("/admin/teams");
```
그리고 import 추가:
```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAdmin } from "@/lib/roles";
```
`src/app/(app)/admin/items/page.tsx` 에도 동일하게 추가.

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 성공.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/admin/
git commit -m "feat: open admin area to HR managers with admin-only guards"
```

---

## Task 13: 팀 관리 화면 (/admin/teams)

**Files:** Create `src/app/(app)/admin/teams/team-forms.tsx`, `src/app/(app)/admin/teams/page.tsx`

- [ ] **Step 1: 폼/조작 (client)**

`src/app/(app)/admin/teams/team-forms.tsx`:
```tsx
"use client";

import { useState } from "react";
import {
  createTeam, setTeamLeader, assignEmployeeTeam, setApprover,
} from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Person { id: string; name: string }
interface TeamOpt { id: string; name: string }

export function NewTeam() {
  const [busy, setBusy] = useState(false);
  return (
    <form action={async (fd) => { setBusy(true); await createTeam(fd); setBusy(false); }} className="flex items-end gap-2">
      <Input name="name" placeholder="팀 이름" required className="max-w-xs" />
      <Button type="submit" disabled={busy}>팀 추가</Button>
    </form>
  );
}

export function LeaderSelect({ teamId, leaderId, people }: { teamId: string; leaderId: string | null; people: Person[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={leaderId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await setTeamLeader(teamId, e.target.value || null); setBusy(false); }}>
      <option value="">(미지정)</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function TeamSelect({ userId, teamId, teams }: { userId: string; teamId: string | null; teams: TeamOpt[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={teamId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await assignEmployeeTeam(userId, e.target.value || null); setBusy(false); }}>
      <option value="">(없음)</option>
      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

export function ApproverSelect({ userId, approverId, people }: { userId: string; approverId: string | null; people: Person[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <select defaultValue={approverId ?? ""} disabled={busy}
      className="rounded-md border px-2 py-1 text-sm"
      onChange={async (e) => { setBusy(true); await setApprover(userId, e.target.value || null); setBusy(false); }}>
      <option value="">(미지정)</option>
      {people.filter((p) => p.id !== userId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
```

- [ ] **Step 2: 페이지 (server)**

`src/app/(app)/admin/teams/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { NewTeam, LeaderSelect, TeamSelect, ApproverSelect } from "./team-forms";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function TeamsPage() {
  const supabase = await createClient();
  const [teamsRes, usersRes] = await Promise.all([
    supabase.from("teams").select("id, name, leader_id").order("name"),
    supabase.from("users").select("id, name, team_id, approver_id, role").order("name"),
  ]);
  const teams = teamsRes.data ?? [];
  const users = usersRes.data ?? [];
  const people = users.map((u) => ({ id: u.id, name: u.name }));
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>팀 관리</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <NewTeam />
          <Table>
            <TableHeader><TableRow><TableHead>팀</TableHead><TableHead>팀장</TableHead></TableRow></TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell><LeaderSelect teamId={t.id} leaderId={t.leader_id} people={people} /></TableCell>
                </TableRow>
              ))}
              {teams.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground">팀이 없습니다.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">직원 배정</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>이름</TableHead><TableHead>팀</TableHead><TableHead>직속 결재자</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell><TeamSelect userId={u.id} teamId={u.team_id} teams={teams} /></TableCell>
                <TableCell>
                  <ApproverSelect userId={u.id} approverId={u.approver_id} people={people} />
                  {u.approver_id && <span className="ml-2 text-xs text-muted-foreground">→ {nameById.get(u.approver_id) ?? ""}</span>}
                </TableCell>
              </TableRow>
            ))}
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
Expected: 성공. `/admin/teams` 라우트 생성.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/admin/teams/
git commit -m "feat: add team management page"
```

---

## Task 14: 연차 관리 화면 (/admin/leave)

**Files:** Create `src/app/(app)/admin/leave/leave-admin.tsx`, `src/app/(app)/admin/leave/page.tsx`

- [ ] **Step 1: 조작 (client)**

`src/app/(app)/admin/leave/leave-admin.tsx`:
```tsx
"use client";

import { useState } from "react";
import { generateGrants, setHireDate, setGrant } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GenerateButton({ year }: { year: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy}
      onClick={async () => { setBusy(true); await generateGrants(year); setBusy(false); }}>
      {busy ? "산정 중..." : `${year}년 연차 일괄 산정`}
    </Button>
  );
}

export function HireDateInput({ userId, hireDate }: { userId: string; hireDate: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <Input type="date" defaultValue={hireDate ?? ""} disabled={busy} className="h-8 w-40"
      onBlur={async (e) => { setBusy(true); await setHireDate(userId, e.target.value); setBusy(false); }} />
  );
}

export function GrantInput({ userId, year, days }: { userId: string; year: number; days: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <Input type="number" step="0.5" min="0" defaultValue={days} disabled={busy} className="h-8 w-24"
      onBlur={async (e) => { setBusy(true); await setGrant(userId, year, Number(e.target.value)); setBusy(false); }} />
  );
}
```

- [ ] **Step 2: 페이지 (server)**

`src/app/(app)/admin/leave/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { GenerateButton, HireDateInput, GrantInput } from "./leave-admin";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function LeaveAdminPage() {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [usersRes, grantsRes] = await Promise.all([
    supabase.from("users").select("id, name, hire_date").order("name"),
    supabase.from("leave_grants").select("user_id, granted_days").eq("year", year),
  ]);
  const users = usersRes.data ?? [];
  const grantByUser = new Map((grantsRes.data ?? []).map((g) => [g.user_id, Number(g.granted_days)]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">연차 관리 ({year}년)</h2>
        <GenerateButton year={year} />
      </div>
      <p className="text-sm text-muted-foreground">입사일을 입력한 뒤 “일괄 산정”을 누르면 한국법 기준으로 자동 부여됩니다. 부여일수는 개별 수정 가능합니다.</p>
      <Table>
        <TableHeader>
          <TableRow><TableHead>이름</TableHead><TableHead>입사일</TableHead><TableHead>{year}년 부여일수</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell><HireDateInput userId={u.id} hireDate={u.hire_date} /></TableCell>
              <TableCell><GrantInput userId={u.id} year={year} days={grantByUser.get(u.id) ?? 0} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 성공. `/admin/leave` 라우트 생성.

- [ ] **Step 4: Commit**
```bash
git add src/app/\(app\)/admin/leave/
git commit -m "feat: add leave grant management page"
```

---

## Task 15: 대시보드 연차 위젯 + 전체 검증

**Files:** Modify `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: 대시보드에 내 잔여 연차 위젯 추가**

`src/app/(app)/dashboard/page.tsx`의 `Promise.all` 배열에 연차 잔여 조회를 추가한다. 기존 배열:
```tsx
  const [myClaimsRes, inboxRes, noticesRes] = await Promise.all([
```
를 다음으로 교체:
```tsx
  const year = new Date().getFullYear();
  const [myClaimsRes, inboxRes, noticesRes, grantRes, leaveUsedRes] = await Promise.all([
```
그리고 같은 `Promise.all` 배열의 마지막 항목(noticesRes 정의) 뒤에 두 항목을 추가:
```tsx
    supabase.from("leave_grants").select("granted_days").eq("user_id", user.id).eq("year", year).maybeSingle(),
    supabase.from("leave_requests").select("days, start_date").eq("user_id", user.id).eq("status", "approved"),
```
`const notices = noticesRes.data;` 아래에 추가:
```tsx
  const granted = Number(grantRes.data?.granted_days ?? 0);
  const usedLeave = (leaveUsedRes.data ?? [])
    .filter((r) => r.start_date.startsWith(String(year)))
    .reduce((s, r) => s + Number(r.days), 0);
  const remainingLeave = granted - usedLeave;
```
그리고 복지 위젯 그리드(첫 번째 `<Link href="/welfare">...</Link>` 와 결재자 카드가 들어있는 `<div className="grid ...">`) 안, 결재자 카드 `)}` 다음에 연차 카드를 추가:
```tsx
        <Link href="/leave">
          <Card className="transition hover:bg-muted/50">
            <CardHeader><CardTitle className="text-base">내 잔여 연차</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{remainingLeave}일</CardContent>
          </Card>
        </Link>
```

- [ ] **Step 2: 단위 테스트 + 빌드**
```bash
npm test && npm run build
```
Expected: 테스트 전체 PASS(기존 12 + roles 보강 + leave-calc 9), 빌드 성공. 라우트 `/leave`, `/leave/inbox`, `/admin/teams`, `/admin/leave` 생성.

- [ ] **Step 3: Commit**
```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add remaining leave widget to dashboard"
```

---

## Task 16: 수동 E2E 검증 (dev 서버)

- [ ] **Step 1: 검증 시나리오**
```bash
npm run dev
```
관리자(이태규=대표, admin)로 로그인 후:
1. **인사 > 팀**: 팀 생성, 팀장 지정 — 우선 테스트용으로 직원 계정 2개 발급 필요(대표 화면 직원/계정에서). 팀장 역할(approver)·팀원 역할(staff) 부여
2. 팀원의 팀 배정 → 직속 결재자가 팀장으로 자동 설정되는지
3. **인사 > 연차 관리**: 팀원 입사일 입력 → “일괄 산정” → 부여일수 자동 표시, 개별 수정 동작
4. 팀원 계정으로 로그인 → **연차** 신청(반차/종일) → 잔여 차감 표시(승인 후)
5. 팀장 계정 로그인 → **연차 승인함**에 그 신청 표시 → 승인 → 팀원 화면에서 잔여 감소 확인
6. 반려(사유) → 팀원 내역에 반려·사유 표시
7. 권한: 팀원은 `/leave/inbox`·`/admin/teams` 접근 시 리다이렉트

Expected: 위 흐름 동작. (직속 결재자 라우팅·겸임·연차 계산·차감 검증)

---

## Self-Review 결과 (작성자 점검)
- **스펙 커버리지:** 4단계 역할(hr_manager 추가, Task4) ✓, approver_id 1단계 결재(Task7,11) ✓, 겸임=approver_id로 자연 처리 ✓, 한국법 계산(Task5) ✓, 종일/반차·평일카운트(Task5) ✓, 팀/입사일/부여 관리(Task8,13,14) ✓, 일괄 산정+개별 수정(Task8,14) ✓, 잔여=부여−사용(Task10,15) ✓, RLS(Task3) ✓, 결재자 미지정 차단(Task7) ✓.
- **플레이스홀더:** 없음(모든 코드 스텝에 실제 코드). Task12/15는 기존 파일 부분수정이라 위치·코드 명시.
- **타입 일관성:** `Role`(hr_manager 포함)·`LeaveStatus`·`computeLegalLeave`/`countLeaveDays` 시그니처가 액션·페이지·테스트에서 일관. 결재 동시성은 `.eq('status','pending')` + `.eq('approver_id', uid)`로 강제.
- **주의:** 조인 결과 `any`는 기존 방침과 동일(MVP). users RLS의 hr 수정은 컬럼 제한이 없어 UI로 통제(역할 변경은 대표 화면만) — spec에 명시됨.

## 다음
- 실행: subagent-driven으로 Task별 구현. Supabase 마이그레이션(Task1~3)은 컨트롤러가 MCP로 적용, 코드 Task는 서브에이전트.
