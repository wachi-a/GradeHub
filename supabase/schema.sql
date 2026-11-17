-- Run once in Supabase > SQL Editor. All user data remains private via RLS.
create table if not exists public.gradehub_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);

alter table public.gradehub_documents enable row level security;
revoke all on public.gradehub_documents from anon, authenticated;
grant select, insert, update on public.gradehub_documents to authenticated;

drop policy if exists "Read own GradeHub" on public.gradehub_documents;
create policy "Read own GradeHub" on public.gradehub_documents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Create own GradeHub" on public.gradehub_documents;
create policy "Create own GradeHub" on public.gradehub_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own GradeHub" on public.gradehub_documents;
create policy "Update own GradeHub" on public.gradehub_documents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
