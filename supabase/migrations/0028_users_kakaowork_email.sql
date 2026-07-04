-- 카카오워크 DM 조회용 이메일.
-- 앱 로그인 이메일(@hanyeongtax.com)과 카카오워크 로그인 이메일(gmail/naver 등)이
-- 다른 직원을 위해 별도 보관한다. 비어 있으면 알림 코드가 users.email 로 폴백한다.
alter table public.users add column if not exists kakaowork_email text;
