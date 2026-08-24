-- 010: cafes_with_coords 뷰 SECURITY DEFINER 제거
--
-- Supabase Security Advisor Critical 지적: 뷰가 SECURITY DEFINER라
-- 조회자가 아닌 생성자(관리자) 권한/RLS로 실행됨 — anon 키만 있으면
-- 베이스 테이블 RLS를 우회해 뷰의 모든 컬럼을 읽을 수 있다.
--
-- 2026-08 /api/cafes 전환(PR #20) 이후 클라이언트는 Supabase를 직접 읽지
-- 않고 서버(service_role, RLS 우회)만 이 뷰를 조회하므로, invoker 권한으로
-- 바꿔도 서비스 동작에 영향이 없다.
-- Supabase SQL Editor에서 실행

ALTER VIEW public.cafes_with_coords SET (security_invoker = true);

-- 확인: relkind 'v'인 뷰의 reloptions에 security_invoker=true가 보여야 함
SELECT c.relname, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'cafes_with_coords';
