-- 게시판 종류: free(자유게시판) / work(업무공유게시판). 기존 글은 업무공유로.
alter table public.posts
  add column board_type text not null default 'work'
  check (board_type in ('free', 'work'));
