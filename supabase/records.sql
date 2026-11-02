-- 말씨앗 の記録（集めた語と覚え具合。src/data/record.ts の RecordState）を、アカウントごとに1行。アカウントは ことのあめ のもの
-- （同じ Supabase。ことのめ・ことのは などと同じ。ログインは任意で、していなければ何も置かない）。
-- 名前はすべて kh_ で始める（ことのあめ は pl_、ことのね は kn_、ほかの姉妹アプリ・旧アプリの表には触れない）。
-- ブラウザから本人として読み書きする（RLS：ログインした本人の行だけ）。
--
-- 当て方（ことのあめ のリポジトリで。何度当ててもよい）：
--   node --env-file=.env.local scripts/migrate.mjs ../hanjaeo/supabase/records.sql
-- 外すとき：drop table public.kh_records;

create table if not exists public.kh_records (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  -- 集めた語は多くても数千語。記録のほかの置き場に使われないように。
  constraint kh_records_size check (pg_column_size(state) < 1048576)
);

alter table public.kh_records enable row level security;

drop policy if exists "kh_records own" on public.kh_records;
create policy "kh_records own" on public.kh_records
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
