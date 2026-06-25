-- current_role() 노출 하드닝:
-- PUBLIC(=anon 포함) EXECUTE 회수, authenticated 에게만 부여.
-- (이 함수는 호출자 본인의 역할만 반환하므로 authenticated 호출은 데이터 노출 위험이 없음.
--  RLS 정책 평가에 authenticated EXECUTE 권한이 필요하므로 유지한다.)
revoke execute on function public.current_role() from public;
revoke execute on function public.current_role() from anon;
grant execute on function public.current_role() to authenticated;
