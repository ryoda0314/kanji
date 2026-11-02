-- 말씨앗 の みんなの雨：集めた語を、名前も端末の番号も付けずに受け取り、この1時間にみんなが集めた語を返す
-- （アプリの 見つける → みんなの雨、src/util/falls.ts）。ことのあめ の Supabase に、말씨앗 の表として置く（名前は kh_ で始める）。
--
-- 受け取るのは、辞書（public/data/words.json）の中の語の番号と、辞書の版（words.json の中身から作った短い名前）だけ。
-- 言葉そのものは受け取らないので、辞書に無い言葉は降らない。手で登録した語・辞書に無い語は、アプリが送らない。
-- 表は外から読めず書けず、kh_fall だけが足し、kh_recent だけが直近の分を返す。
--
-- 当て方（ことのあめ のリポジトリで。何度当ててもよい）：
--   node --env-file=.env.local scripts/migrate.mjs ../hanjaeo/supabase/falls.sql
-- 外すとき：drop function public.kh_recent(text, bigint); drop function public.kh_fall(text, int); drop table public.kh_falls;

create table if not exists public.kh_falls (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- 辞書の版。番号の指す語は版ごとに違うので、同じ版の分だけを返す。
  ver text not null,
  -- 辞書の中の語の番号（words.json の並び）
  word int not null
);
create index if not exists kh_falls_at on public.kh_falls (at);

alter table public.kh_falls enable row level security;
revoke all on table public.kh_falls from public, anon, authenticated;

-- 一つ足す。だれでも呼べるので、1分に足せる数に天井を付ける（呼び続けられても、表が際限なく大きくならないように）。
-- 天井は、話題になった1分でも届かない高さに。降らせるのは直近だけなので、2日より古い分はときどき消す。
create or replace function public.kh_fall(p_ver text, p_word int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ver is null or length(p_ver) > 16 or p_word is null or p_word < 0 or p_word > 1000000 then
    return;
  end if;
  if (select count(*) from kh_falls where at > now() - interval '1 minute') >= 600 then
    return;
  end if;
  insert into kh_falls (ver, word) values (p_ver, p_word);
  if random() < 0.01 then
    delete from kh_falls where at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function public.kh_fall(text, int) from public;
grant execute on function public.kh_fall(text, int) to anon, authenticated;

-- この1時間に降った語（p_after より新しい分、同じ語は一番新しい一度だけ、新しい順に200まで）と、この1時間に降った数。
-- 同じ語をくり返し送られても、一度しか降らない。
create or replace function public.kh_recent(p_ver text, p_after bigint default 0)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from kh_falls where at > now() - interval '1 hour'),
    'falls', coalesce((
      select json_agg(json_build_object('id', d.id, 'word', d.word, 'at', d.at) order by d.id desc)
      from (
        select id, word, at from (
          select distinct on (word) id, word, at
          from kh_falls
          where ver = p_ver and at > now() - interval '1 hour' and id > coalesce(p_after, 0)
          order by word, id desc
        ) latest
        order by id desc
        limit 200
      ) d
    ), '[]'::json)
  );
$$;

revoke all on function public.kh_recent(text, bigint) from public;
grant execute on function public.kh_recent(text, bigint) to anon, authenticated;

-- すぐ アプリ から呼べるように（Supabase の API に作り直したことを知らせる）。
notify pgrst, 'reload schema';
