-- 연차 종류: 종일/오전반차/오후반차/1·2·3시간 시차 (1일=8H 기준 차감)
create type leave_type as enum ('full', 'half_am', 'half_pm', 'hourly_1', 'hourly_2', 'hourly_3');

alter table public.leave_requests
  add column leave_type leave_type not null default 'full';

-- 시차(0.125 등 8분의 1 단위) 저장을 위해 days 정밀도 확장
alter table public.leave_requests
  alter column days type numeric(6,3);

-- 기존 반차 데이터는 오전반차로 매핑
update public.leave_requests set leave_type = 'half_am' where half_day = true;
