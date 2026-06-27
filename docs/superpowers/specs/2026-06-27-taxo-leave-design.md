# 연차 결재 시스템 — 설계 문서 (Design Spec)

- **작성일:** 2026-06-27
- **프로젝트:** taxo 사내 인트라넷 — 2차 기능
- **상태:** 설계 확정

## 1. 목적 (Purpose)

직원이 연차/반차를 신청하면 **직속 결재자**가 승인/반려하는 결재 시스템. 입사일 기준 한국 근로기준법에 따라 연초에 연차를 자동 부여하되, 관리자가 개별 수정할 수 있다.

## 2. 범위 (Scope)

### 포함 (이번 2차)
- 4단계 조직 계층(팀원/팀장/인사관리자/대표) + 팀 구성
- 직속 결재자(approver_id) 기반 1단계 결재
- 입사일·한국법 기준 연차 자동 부여 + 관리자 개별 수정
- 연차/반차(0.5일) 신청·차감, 잔여 자동 계산
- HR 관리 화면(팀·결재자·입사일·연차부여)

### 제외 (YAGNI / 후속)
- 시간 단위 연차, 공휴일 자동 제외(평일만 카운트, 공휴일은 수동 조정)
- 다단계(2단계 이상) 동시 결재선
- 연차 촉진제·이월 자동화

## 3. 조직 구조 & 권한 (Roles)

4단계 계층. 기존 역할 enum(`staff/approver/admin`)에 **`hr_manager` 추가**.

| 직위 | role 값 | 결재 가능 | HR 관리 | 비고 |
|------|---------|-----------|---------|------|
| 팀원 | `staff` | ✗ | ✗ | |
| 팀장 | `approver` | ✓ | ✗ | 자기 팀 결재 |
| 인사관리자 | `hr_manager` | ✓ | ✓ | 1팀장 겸직 가능 |
| 대표 | `admin` | ✓ | ✓ | 최상위(2명) |

**권한 헬퍼** (`src/lib/roles.ts`):
- `canApprove(role)` = `approver | hr_manager | admin` (기존에 hr_manager 추가)
- `canManageHR(role)` = `hr_manager | admin` (신규 — 팀·연차·계정 관리)
- `canAdmin(role)` = `admin` (기존 유지 — 대표 전용)

> 기존 복지/자료실 시스템: `canApprove`에 hr_manager가 추가되어 인사관리자도 복지 승인·자료 작성 가능. 복지 '지급처리'는 기존대로 `canAdmin`(대표) 유지.

## 4. 결재 흐름 (Approval Flow) — 직속 결재자 1단계

각 직원에 **`approver_id`(직속 결재자) 1명**을 지정한다. 연차 신청은 그 결재자에게만 전달되고 **한 번 승인으로 완료**된다.

| 신청자 | approver_id (결재자) |
|--------|----------------------|
| 팀원 | 소속 팀의 팀장 |
| 팀장 | 인사관리자 |
| 인사관리자 | 대표 |
| 대표 | (없음 — 신청 불가 또는 다른 대표) |

**겸임 처리:** 인사관리자가 1팀장을 겸직하면, 1팀의 `leader_id` = 인사관리자. 1팀원의 `approver_id` = 1팀장(=인사관리자). 따라서 1팀원 신청 → 인사관리자(=팀장)가 1번 승인 → 완료. 인사관리자 본인 신청 시 `approver_id`=대표.

**팀 배정 시 기본값:** 직원을 팀에 배정하면 `approver_id`를 자동으로 그 팀의 `leader_id`로 설정(이후 개별 변경 가능). 팀장·인사관리자의 `approver_id`는 관리자가 수동 지정.

**상태 흐름:** `pending`(승인 대기) → `approved`(승인) / `rejected`(반려, 사유 필수).

## 5. 연차 자동 부여 계산 (Entitlement)

입사일(`hire_date`)과 대상 연도로 법정 연차를 계산하는 **순수 함수** `computeLegalLeave(hireDate, targetYear)`.

**계산 규칙** (대상 연도 1월 1일 기준 완성 근속연수 `y`):
- `y >= 1`: `min(25, 15 + floor((y - 1) / 2))`
  - 만1년·2년=15, 3·4년=16, 5·6년=17 … 21년+=25(한도)
- `y < 1` (작년 입사, 1년 미만): `min(11, 입사일~대상연도 1/1 까지 완성 개월수)` — 법정 월 1일 발생분
- 대상 연도에 입사(아직 미입사): `0` — 입사 후 월별 발생, 관리자가 수기 부여

> 한국 근로기준법 제60조 기준. 출근율 80% 등 세부 요건/이월/공휴일 변수는 **관리자 개별 수정**으로 보정한다(자동 산정은 기본값 제공).

**부여 저장:** `leave_grants`(직원·연도·부여일수·비고). 관리자가 "연차 일괄 산정" 실행 시 전 직원에 대해 `computeLegalLeave` 결과로 행 생성(이미 있으면 건너뜀), 이후 개별 수정 가능.

## 6. 신청·차감 (Request & Deduction)

- **종일/반차:** 반차 = 0.5일(시작일=종료일). 종일 = 평일 수 자동 카운트.
- **일수 계산** 순수 함수 `countLeaveDays(start, end, halfDay)`:
  - `halfDay=true` → `0.5`
  - 아니면 start~end 사이 **평일(월~금) 수**(주말 제외). 공휴일 미반영(MVP).
- **잔여 = 해당 연도 부여일수 − 그 해 승인된(approved) 신청 일수 합**. 신청 시 잔여 초과면 경고(차단은 관리자 정책에 따라; MVP는 경고만, 제출은 허용하되 결재자 판단).
- 신청 폼: 종일/반차 선택, 시작일·종료일, 사유. 제출 시 일수 자동 계산해 표시.

## 7. 데이터 모델 (Data Model)

**기존 `users` 테이블에 컬럼 추가:**
- `hire_date date` (입사일)
- `team_id uuid references teams(id)` (소속 팀)
- `approver_id uuid references users(id)` (직속 결재자)

**신규 테이블:**

| 테이블 | 주요 컬럼 | 설명 |
|--------|-----------|------|
| `teams` | id, name, leader_id(→users) | 팀, 팀장 |
| `leave_grants` | id, user_id, year, granted_days(numeric), note, created_at | 연도별 부여 연차(개별 수정) |
| `leave_requests` | id, user_id, start_date, end_date, days(numeric), half_day(bool), reason, status(leave_status), approver_id(→users), approved_at, reject_reason, created_at | 연차 신청 |

- enum `leave_status`: `pending | approved | rejected`
- `leave_grants` 는 (user_id, year) 유니크.
- `days numeric(4,1)` (0.5 단위 허용, `> 0` 체크).

## 8. 보안 (RLS)

신규 헬퍼 `is_hr()` = `current_role() in ('hr_manager','admin')`.

- `teams`: 인증 사용자 조회, 작성/수정 = `is_hr()`
- `leave_grants`: 본인 조회 또는 `is_hr()`; 작성/수정 = `is_hr()`
- `leave_requests`:
  - 조회: 본인 `user_id=auth.uid()` OR 결재자 `approver_id=auth.uid()` OR `is_hr()`
  - 생성: 본인(`user_id=auth.uid()`)
  - 수정(승인/반려): 결재자(`approver_id=auth.uid()`) OR `is_hr()`
- `users`: 기존(본인+admin)에 더해 **`is_hr()` 조회·수정 허용**(팀·결재자·입사일 관리용). 역할(role) 변경은 UI에서 대표만 노출(컬럼 단위 제한은 MVP 범위 외, 운영 정책으로 보완).

## 9. 화면 (Screens)

- **직원(전체):** `연차` — 신청 폼(종일/반차) + 내 연차 현황(부여/사용/잔여) + 내 신청 내역
- **결재자(팀장·인사관리자·대표):** `연차 승인함` — `approver_id=나`인 대기 신청 목록, 승인/반려
- **HR 관리(인사관리자·대표):** `관리자 > 인사`
  - 팀 관리: 팀 생성, 팀장 지정, 직원 팀 배정(+직속 결재자 자동/수동 지정)
  - 연차 관리: 입사일 입력, "○○년 연차 일괄 산정", 개별 부여일수 수정

네비게이션(`navItemsForRole`)에 `연차`(전원), `연차 승인함`(결재자), `인사`(HR) 추가.

## 10. 오류 처리 / 엣지 케이스

- `approver_id` 미지정 직원의 신청 → 차단하고 "결재자 미지정, 관리자 문의" 안내
- 종료일 < 시작일, 일수 0 → 검증 실패
- 잔여 부족 → 경고 표시(제출은 결재자 판단에 위임)
- 이미 처리된 신청 재처리 방지(상태 검증, `.eq('status','pending')`)
- 결재자 본인이 자기 신청 자가승인 방지(`user_id != auth.uid()` 체크는 정책상 허용 안 함 → 신청자=결재자 불가, 상위로 라우팅)

## 11. 테스트 (Testing)

- **순수 함수 단위(Vitest, TDD):**
  - `computeLegalLeave`: 1년미만(월 누적·한도11), 만1년=15, 3년=16, 5년=17, 21년+=25 한도, 미입사=0
  - `countLeaveDays`: 반차=0.5, 평일 카운트(주말 제외), 단일일, 주말 포함 구간
- **통합(권한):** 팀원/팀장/인사관리자/대표 RLS — 조회·승인 허용/차단
- **E2E(해피패스):** 팀원 신청 → 팀장 승인 → 잔여 차감 확인 / 반려 → 사유 표시

## 12. 마이그레이션 / 기존 데이터

- `user_role` enum에 `'hr_manager'` 값 추가(별도 마이그레이션, 트랜잭션 분리 주의)
- `users`에 컬럼 추가, 신규 테이블·enum·RLS 생성
- 기존 관리자(이태규)는 `admin`(대표) 유지. 팀/결재자/입사일은 신규 HR 화면에서 설정
- Supabase MCP `apply_migration`으로 적용(서울 리전 프로젝트 `ganihzhdyazowrhmsttl`)

## 13. 향후
- 공휴일 캘린더 연동(평일+공휴일 제외), 연차 촉진·이월, 통계(부서별 사용률), 시간 단위 연차
