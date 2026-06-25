# 기반(Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 발급한 계정으로 로그인하면, 역할(직원/결재자/관리자)에 맞는 메뉴가 보이는 동작하는 앱 골격을 만든다.

**Architecture:** Next.js(App Router) + shadcn/ui 프론트엔드, Supabase(Auth·Postgres·Storage) 백엔드. 인증은 `@supabase/ssr` 쿠키 세션 + Next.js middleware로 보호. 권한은 DB의 `users.role` + RLS로 제어. 순수 로직(역할 판별 등)은 Vitest로 단위 테스트.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase(@supabase/ssr), Vitest + @testing-library/react, npm

---

## File Structure (이 계획에서 만드는 것)

```
taxo/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # 루트 레이아웃
│  │  ├─ page.tsx                # / → /dashboard 리다이렉트
│  │  ├─ login/page.tsx          # 로그인 화면
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx           # 인증 보호 + 사이드바 셸
│  │  │  └─ dashboard/page.tsx   # 빈 대시보드
│  │  └─ auth/signout/route.ts   # 로그아웃
│  ├─ components/
│  │  ├─ ui/                     # shadcn 컴포넌트
│  │  └─ app-sidebar.tsx         # 역할별 네비게이션
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ client.ts            # 브라우저 클라이언트
│  │  │  ├─ server.ts            # 서버 클라이언트
│  │  │  └─ middleware.ts        # 세션 갱신 헬퍼
│  │  ├─ auth.ts                 # getCurrentUser() 등
│  │  └─ roles.ts                # 역할 판별 순수 함수 (테스트 대상)
│  └─ middleware.ts              # 인증 미들웨어
├─ supabase/migrations/          # DB 스키마 SQL
├─ tests/                        # Vitest 단위 테스트
├─ vitest.config.ts
└─ .env.local                    # Supabase 키 (gitignore됨)
```

---

## Task 1: Next.js 프로젝트 스캐폴딩

작업 디렉토리(`C:\Users\code\taxo`)에는 이미 `.git`, `docs/`, `.gitignore`, `.superpowers/`, `.claude/`가 있어서 `create-next-app`을 같은 폴더에서 바로 돌리면 충돌로 중단된다. **임시 폴더에 생성 후 옮긴다.**

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/*` (create-next-app 생성)

- [ ] **Step 1: 임시 폴더에 스캐폴딩**

Git Bash에서:
```bash
cd /c/Users/code
npx create-next-app@latest taxo-scaffold \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```
Expected: `taxo-scaffold/`에 Next.js 프로젝트 생성.

- [ ] **Step 2: 생성물을 taxo로 이동 (기존 .git/.gitignore/docs 보존)**

```bash
cd /c/Users/code/taxo-scaffold
rm -rf .git .gitignore          # 우리 것 사용
shopt -s dotglob
mv * /c/Users/code/taxo/
cd /c/Users/code && rmdir taxo-scaffold
```
Expected: `taxo/`에 `package.json`, `src/`, `next.config.ts` 등이 존재. `taxo/.git`, `taxo/docs`, `taxo/.gitignore`는 그대로.

- [ ] **Step 3: 의존성 확인 및 개발 서버 기동 확인**

```bash
cd /c/Users/code/taxo && npm install && npm run dev
```
브라우저 `http://localhost:3000` 에서 Next.js 기본 페이지 확인 후 `Ctrl+C`.
Expected: 기본 페이지가 뜬다.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/code/taxo
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

---

## Task 2: shadcn/ui 초기화 + 기본 컴포넌트 설치

**Files:**
- Create: `components.json`, `src/components/ui/*`, `src/lib/utils.ts`

- [ ] **Step 1: shadcn 초기화**

```bash
cd /c/Users/code/taxo
npx shadcn@latest init -d
```
Expected: `components.json` 생성, `src/lib/utils.ts` 생성, Tailwind 설정 갱신. (`-d`는 기본값 사용)

- [ ] **Step 2: 1차에서 쓸 기본 컴포넌트 설치**

```bash
npx shadcn@latest add button input label card table badge sonner dropdown-menu avatar separator
```
Expected: `src/components/ui/`에 각 컴포넌트 파일 생성.

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공(에러 0). 경고는 허용.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: init shadcn/ui and install base components"
```

---

## Task 3: Vitest 테스트 환경 구성

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (scripts에 `test` 추가)

- [ ] **Step 1: 테스트 의존성 설치**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: `tests/setup.ts` 작성**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: `package.json` scripts에 test 추가**

`"scripts"` 객체에 다음 줄을 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: 스모크 테스트 작성 (실패 확인용)**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
npm test
```
Expected: PASS (1 passed).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: set up Vitest with React Testing Library"
```

---

## Task 4: 역할 판별 순수 함수 (TDD)

권한 분기에 쓸 순수 함수를 먼저 테스트로 정의한다. DB나 네트워크 없이 테스트 가능한 단위.

**Files:**
- Create: `src/lib/roles.ts`
- Test: `tests/roles.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canApprove, canAdmin, navItemsForRole, type Role } from "@/lib/roles";

describe("roles", () => {
  it("approver and admin can approve, staff cannot", () => {
    expect(canApprove("staff")).toBe(false);
    expect(canApprove("approver")).toBe(true);
    expect(canApprove("admin")).toBe(true);
  });

  it("only admin can access admin area", () => {
    expect(canAdmin("staff")).toBe(false);
    expect(canAdmin("approver")).toBe(false);
    expect(canAdmin("admin")).toBe(true);
  });

  it("staff sees base nav without 승인함/관리자", () => {
    const labels = navItemsForRole("staff").map((i) => i.label);
    expect(labels).toContain("홈");
    expect(labels).toContain("복지 청구");
    expect(labels).not.toContain("승인 대기함");
    expect(labels).not.toContain("관리자");
  });

  it("approver sees 승인 대기함 but not 관리자", () => {
    const labels = navItemsForRole("approver").map((i) => i.label);
    expect(labels).toContain("승인 대기함");
    expect(labels).not.toContain("관리자");
  });

  it("admin sees 관리자", () => {
    const labels = navItemsForRole("admin").map((i) => i.label);
    expect(labels).toContain("관리자");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- roles
```
Expected: FAIL ("Cannot find module '@/lib/roles'" 또는 export 없음).

- [ ] **Step 3: `src/lib/roles.ts` 구현**

```ts
export type Role = "staff" | "approver" | "admin";

export interface NavItem {
  label: string;
  href: string;
}

export function canApprove(role: Role): boolean {
  return role === "approver" || role === "admin";
}

export function canAdmin(role: Role): boolean {
  return role === "admin";
}

export function navItemsForRole(role: Role): NavItem[] {
  const items: NavItem[] = [
    { label: "홈", href: "/dashboard" },
    { label: "복지 청구", href: "/welfare" },
    { label: "자료실", href: "/board" },
  ];
  if (canApprove(role)) {
    items.push({ label: "승인 대기함", href: "/welfare/inbox" });
  }
  if (canAdmin(role)) {
    items.push({ label: "관리자", href: "/admin" });
  }
  return items;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- roles
```
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add role helpers with tests"
```

---

## Task 5: Supabase 프로젝트 생성 및 환경 변수

> 이 단계는 외부 리소스(Supabase 클라우드 프로젝트)가 필요하다. 실행자는 https://supabase.com 에서 무료 프로젝트를 만들거나 Supabase MCP/CLI를 사용한다.

**Files:**
- Create: `.env.local`, `.env.example`

- [ ] **Step 1: Supabase 프로젝트 생성**

Supabase 대시보드에서 새 프로젝트 생성(예: `taxo`, 리전 `Northeast Asia (Seoul)`). 생성 후 Project Settings → API에서 다음을 확보:
- Project URL (예: `https://abcd.supabase.co`)
- `anon` public key
- `service_role` key (서버 전용, 절대 클라이언트 노출 금지)

- [ ] **Step 2: `.env.local` 작성**

```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

- [ ] **Step 3: `.env.example` 작성 (커밋용, 값은 비움)**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: `.env.local`이 gitignore 되는지 확인**

```bash
git check-ignore .env.local
```
Expected: `.env.local` 출력(무시됨). 안 되면 `.gitignore`에 `.env*.local` 확인.

- [ ] **Step 5: Commit (.env.example만)**

```bash
git add .env.example
git commit -m "chore: add env example for Supabase"
```

---

## Task 6: 데이터베이스 스키마 마이그레이션

스펙의 데이터 모델(users, welfare_items, welfare_claims, attachments, posts, post_files)을 생성한다. 이 계획에서는 전체 스키마를 한 번에 만들고, 이후 계획에서 사용한다.

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0001_init.sql`:
```sql
-- 역할/상태 enum
create type user_role as enum ('staff', 'approver', 'admin');
create type claim_status as enum ('draft', 'pending', 'approved', 'rejected', 'paid');

-- 직원/계정 (auth.users 와 1:1)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'staff',
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 복지 항목
create table public.welfare_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 복지 청구
create table public.welfare_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  item_id uuid not null references public.welfare_items(id),
  amount integer not null check (amount > 0),
  reason text not null,
  status claim_status not null default 'pending',
  approver_id uuid references public.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);

-- 청구 증빙 첨부
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.welfare_claims(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- 자료실 글/공지
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id),
  category text not null default '일반',
  title text not null,
  body text not null default '',
  is_notice boolean not null default false,
  created_at timestamptz not null default now()
);

-- 자료실 첨부
create table public.post_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- 초기 복지 항목 시드
insert into public.welfare_items (name, monthly_limit) values
  ('경조사비', null),
  ('의료비', null),
  ('자기계발비', 200000),
  ('도서구입비', 50000),
  ('식대', null),
  ('명절/생일 선물', null);
```

- [ ] **Step 2: 마이그레이션 적용**

Supabase 대시보드 SQL Editor에 위 SQL을 붙여 실행하거나, Supabase MCP `apply_migration`/CLI `supabase db push`로 적용.
Expected: 6개 테이블 + 2개 enum 생성, welfare_items 6행.

- [ ] **Step 3: 적용 확인**

Supabase SQL Editor에서:
```sql
select count(*) from public.welfare_items;
```
Expected: `6`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema and welfare item seed"
```

---

## Task 7: RLS(행 수준 보안) 정책

역할 기반 접근 제어를 DB에서 강제한다.

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: RLS SQL 작성**

`supabase/migrations/0002_rls.sql`:
```sql
-- 현재 사용자 역할 헬퍼
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

alter table public.users enable row level security;
alter table public.welfare_items enable row level security;
alter table public.welfare_claims enable row level security;
alter table public.attachments enable row level security;
alter table public.posts enable row level security;
alter table public.post_files enable row level security;

-- users: 본인 조회, 관리자 전체 조회/수정
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.current_role() = 'admin');
create policy users_admin_all on public.users
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- welfare_items: 활성 항목은 모두 조회, 변경은 관리자만
create policy items_select on public.welfare_items
  for select using (is_active or public.current_role() = 'admin');
create policy items_admin_write on public.welfare_items
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- welfare_claims: 본인 것 또는 결재자/관리자 조회
create policy claims_select on public.welfare_claims
  for select using (
    user_id = auth.uid() or public.current_role() in ('approver','admin')
  );
-- 본인만 신청 생성
create policy claims_insert_self on public.welfare_claims
  for insert with check (user_id = auth.uid());
-- 결재자/관리자는 결재 처리(update), 본인은 자기 draft 수정 가능
create policy claims_update on public.welfare_claims
  for update using (
    public.current_role() in ('approver','admin')
    or (user_id = auth.uid())
  );

-- attachments: 연결된 claim 접근 권한과 동일
create policy attachments_select on public.attachments
  for select using (
    exists (
      select 1 from public.welfare_claims c
      where c.id = claim_id
        and (c.user_id = auth.uid() or public.current_role() in ('approver','admin'))
    )
  );
create policy attachments_insert on public.attachments
  for insert with check (
    exists (
      select 1 from public.welfare_claims c
      where c.id = claim_id and c.user_id = auth.uid()
    )
  );

-- posts: 모든 인증 사용자 조회, 결재자/관리자만 작성
create policy posts_select on public.posts
  for select using (auth.uid() is not null);
create policy posts_write on public.posts
  for all using (public.current_role() in ('approver','admin'))
  with check (public.current_role() in ('approver','admin'));

-- post_files: posts 와 동일 규칙
create policy post_files_select on public.post_files
  for select using (auth.uid() is not null);
create policy post_files_write on public.post_files
  for all using (public.current_role() in ('approver','admin'))
  with check (public.current_role() in ('approver','admin'));
```

- [ ] **Step 2: 적용**

Supabase SQL Editor 또는 MCP/CLI로 적용.
Expected: 정책 생성, 에러 없음.

- [ ] **Step 3: 적용 확인**

```sql
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
```
Expected: 위에서 정의한 정책들이 보인다.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat: add RLS policies for role-based access"
```

---

## Task 8: Supabase 클라이언트 (브라우저/서버/미들웨어)

`@supabase/ssr` 패턴으로 쿠키 기반 세션을 구성한다.

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 1: 패키지 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: 브라우저 클라이언트**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: 서버 클라이언트**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 무시 (middleware가 갱신 담당)
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: 미들웨어 세션 갱신 헬퍼**

`src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 비로그인 사용자는 /login 으로
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client/server/middleware helpers"
```

---

## Task 9: 인증 미들웨어 등록

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 미들웨어 작성**

`src/middleware.ts`:
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // _next, 정적파일, 이미지 제외
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: register auth middleware"
```

---

## Task 10: 현재 사용자 조회 헬퍼

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: 작성**

`src/lib/auth.ts`:
```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  is_active: boolean;
}

/** 로그인 + 활성 계정이 아니면 /login 으로 보낸다. */
export async function requireUser(): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role, department, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return profile as AppUser;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add requireUser auth helper"
```

---

## Task 11: 로그인 화면

관리자가 발급한 이메일/비밀번호로 로그인. 자가가입 없음.

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`

- [ ] **Step 1: 서버 액션 작성**

`src/app/login/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }
  redirect("/dashboard");
}
```

- [ ] **Step 2: 로그인 페이지 작성**

`src/app/login/page.tsx`:
```tsx
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>세무사무소 사내 시스템</CardTitle>
          <CardDescription>관리자가 발급한 계정으로 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error === "invalid" && (
              <p className="text-sm text-destructive">
                이메일 또는 비밀번호가 올바르지 않습니다.
              </p>
            )}
            {error === "inactive" && (
              <p className="text-sm text-destructive">
                비활성화된 계정입니다. 관리자에게 문의하세요.
              </p>
            )}
            <Button type="submit" className="w-full">
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add login page and action"
```

---

## Task 12: 로그아웃 라우트

**Files:**
- Create: `src/app/auth/signout/route.ts`

- [ ] **Step 1: 작성**

`src/app/auth/signout/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add signout route"
```

---

## Task 13: 사이드바 네비게이션 (역할별)

**Files:**
- Create: `src/components/app-sidebar.tsx`

- [ ] **Step 1: 작성**

`src/components/app-sidebar.tsx`:
```tsx
import Link from "next/link";
import { navItemsForRole, type Role } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppSidebar({ name, role }: { name: string; role: Role }) {
  const items = navItemsForRole(role);
  return (
    <aside className="flex w-56 flex-col border-r bg-background p-4">
      <div className="mb-1 text-lg font-semibold">세무사무소</div>
      <div className="mb-4 text-sm text-muted-foreground">
        {name} 님 ({role})
      </div>
      <Separator className="mb-4" />
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" className="w-full">
          로그아웃
        </Button>
      </form>
    </aside>
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
git add -A
git commit -m "feat: add role-based sidebar navigation"
```

---

## Task 14: 보호된 앱 레이아웃 + 대시보드 + 루트 리다이렉트

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 보호 레이아웃 작성**

`src/app/(app)/layout.tsx`:
```tsx
import { requireUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <AppSidebar name={user.name} role={user.role} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: 대시보드 작성**

`src/app/(app)/dashboard/page.tsx`:
```tsx
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">홈</h1>
      <p className="text-muted-foreground">
        {user.name} 님, 환영합니다. ({user.department ?? "부서 미지정"})
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        복지 청구·자료실 기능은 다음 단계에서 추가됩니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 루트를 대시보드로 리다이렉트**

`src/app/page.tsx` 전체를 교체:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add protected app layout, dashboard, and root redirect"
```

---

## Task 15: 첫 관리자 계정 만들기 (수동 부트스트랩) + 수동 검증

계정 자가가입이 없으므로 최초 관리자 1명은 수동으로 만든다.

**Files:** (없음 — 운영 절차)

- [ ] **Step 1: Supabase Auth에 사용자 생성**

Supabase 대시보드 → Authentication → Users → Add user → 이메일/비밀번호 입력(예: 대표 이메일). 생성된 user의 UUID를 복사.

- [ ] **Step 2: users 테이블에 프로필 생성(관리자 역할)**

Supabase SQL Editor에서 (`<UUID>`, 이름/이메일 교체):
```sql
insert into public.users (id, name, email, role, department)
values ('<UUID>', '대표', 'ceo@example.com', 'admin', '경영');
```

- [ ] **Step 3: 개발 서버에서 로그인 검증**

```bash
npm run dev
```
브라우저 `http://localhost:3000` 접속 → `/login`으로 이동되는지 확인 → 위 계정으로 로그인 → `/dashboard`로 이동하고 사이드바에 **홈·복지 청구·자료실·승인 대기함·관리자**가 모두 보이는지 확인(admin이므로 전부 노출).
Expected: 로그인 성공, 관리자 메뉴 전부 표시. 로그아웃 클릭 시 `/login` 복귀.

- [ ] **Step 4: 비로그인 보호 검증**

로그아웃 상태에서 주소창에 `http://localhost:3000/dashboard` 직접 입력.
Expected: `/login`으로 리다이렉트.

---

## Task 16: 전체 테스트 + 푸시

- [ ] **Step 1: 단위 테스트 전체 실행**

```bash
npm test
```
Expected: 모든 테스트 PASS (roles 5 + smoke 1).

- [ ] **Step 2: 빌드 최종 확인**

```bash
npm run build
```
Expected: 빌드 성공.

- [ ] **Step 3: GitHub에 푸시**

```bash
git push origin main
```
Expected: `mltax/taxo`에 반영.

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지:** 역할 3종(roles.ts/RLS) ✓, 관리자 계정발급 방식(자가가입 없음, Task 15) ✓, 비활성 계정 차단(requireUser) ✓, 인증 보호(middleware) ✓, 데이터 모델 6테이블(Task 6) ✓, 보안 RLS(Task 7) ✓. 복지 청구·자료실 **화면/로직**은 계획 2·3에서 구현(스키마는 본 계획에서 선반영).
- **플레이스홀더:** 없음. 모든 코드 스텝에 실제 코드 포함.
- **타입 일관성:** `Role` 타입은 `roles.ts` 정의를 `auth.ts`·사이드바에서 재사용. `navItemsForRole`/`canApprove`/`canAdmin` 시그니처 일관.

---

## 다음 계획
- **계획 2 — 복지 청구·승인:** 신청 폼·파일 업로드, 상태머신(draft→pending→approved/rejected→paid) TDD, 승인 대기함, 관리자 지급 처리.
- **계획 3 — 자료실·공지:** 게시판 목록/상세/작성, 파일 업/다운로드, 대시보드 공지 노출.
