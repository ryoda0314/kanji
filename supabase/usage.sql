-- 말씨앗 の使われ方の数（何人が使っているか）。ことのあめ の Supabase（旧アプリとも共有）に、말씨앗 の表として置く。
-- 名前はすべて kh_ で始める（ことのあめ は pl_、旧アプリの表には触れない）。
--
-- 送られるのは、端末ごとの番号（その端末で作った乱数。人とは結びつかない）と、1時間ごとの回数（開いた・あつめた・読めた）と、
-- ホーム画面から開いたかどうかだけ。集めた語・文・名前・メールは送らない。
-- 表は外から読めず書けず、kh_ping だけがその時間の行を足して数える。
-- まとめは Supabase の中で数える（kh_summary：これまで・きょう・7日・30日の端末の数、kh_stats：日ごと、kh_hourly：時間ごと、
-- kh_cohorts：初めて来た日ごとに、その後の日にまた来た端末の数）。
-- 見るのは Supabase の画面か、말씨앗 の scripts/usage.mjs（service role で、このまとめだけを読む）。
--
-- 当て方（ことのあめ のリポジトリで。何度当ててもよい）：
--   node --env-file=.env.local scripts/migrate.mjs ../hanjaeo/supabase/usage.sql
-- ことのね の usage.sql と同じ作り。말씨앗 は初めから1時間ごと（kh_hours）に数える。kh_days は、まとめの形を ことのね と
-- そろえるために置く空の表（ことのね では、1時間ごとに切り替える前の日ごとの数が入っている）。
-- 外すとき：drop view public.kh_cohorts, public.kh_summary, public.kh_stats, public.kh_hourly; drop function public.kh_ping(uuid, text, boolean);
--           drop table public.kh_hours, public.kh_days;

-- 日ごとの数（ことのね とそろえた形。말씨앗 では空のまま）。
create table if not exists public.kh_days (
  device uuid not null,
  day date not null,
  opens int not null default 0,
  collects int not null default 0,
  reads int not null default 0,
  standalone boolean not null default false,
  primary key (device, day)
);
alter table public.kh_days enable row level security;
revoke all on table public.kh_days from public, anon, authenticated;

create table if not exists public.kh_hours (
  device uuid not null,
  -- 日本の時刻で、その時間の頭（13:00 なら 13:00〜13:59 の分）
  hour timestamp not null,
  opens int not null default 0,
  collects int not null default 0,
  reads int not null default 0,
  -- その時間に、ホーム画面のアイコンから開いたことがある
  standalone boolean not null default false,
  primary key (device, hour)
);
create index if not exists kh_hours_hour on public.kh_hours (hour);

alter table public.kh_hours enable row level security;
revoke all on table public.kh_hours from public, anon, authenticated;

-- その時間の行に一つ数える。知らない種類は数えない。だれでも呼べるので、1時間の端末の数と回数に天井を付ける
-- （番号を変えて呼び続けられても、表が際限なく大きくならないように）。天井は、話題になった1時間でも届かない高さに。
create or replace function public.kh_ping(p_device uuid, p_kind text, p_standalone boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  this_hour timestamp := date_trunc('hour', now() at time zone 'Asia/Tokyo');
begin
  if p_device is null or p_kind not in ('open', 'collect', 'read') then
    return;
  end if;
  if not exists (select 1 from kh_hours where device = p_device and hour = this_hour)
     and (select count(*) from kh_hours where hour = this_hour) >= 20000 then
    return;
  end if;
  insert into kh_hours as h (device, hour, opens, collects, reads, standalone)
  values (
    p_device,
    this_hour,
    (p_kind = 'open')::int,
    (p_kind = 'collect')::int,
    (p_kind = 'read')::int,
    coalesce(p_standalone, false)
  )
  on conflict (device, hour) do update set
    opens = least(h.opens + excluded.opens, 500),
    collects = least(h.collects + excluded.collects, 500),
    reads = least(h.reads + excluded.reads, 500),
    standalone = h.standalone or excluded.standalone;
end;
$$;

revoke all on function public.kh_ping(uuid, text, boolean) from public;
grant execute on function public.kh_ping(uuid, text, boolean) to anon, authenticated;

-- まとめ。最初の版のまとめ（kh_stats）とは列の型が違うので、消して作り直す（見え方の定義だけで、数は表に残る）。
drop view if exists public.kh_cohorts;
drop view if exists public.kh_summary;
drop view if exists public.kh_stats;
drop view if exists public.kh_hourly;

-- 時間ごと（日本の時刻）。1時間ごとに数えはじめてからの分だけ。Supabase の画面では新しい順に出る。
create view public.kh_hourly with (security_invoker = true) as
select
  hour,
  count(*) as devices,
  count(*) filter (where standalone) as from_home,
  sum(opens)::bigint as opens,
  sum(collects)::bigint as collects,
  sum(reads)::bigint as reads
from public.kh_hours
group by hour
order by hour desc;

-- 日ごと。端末の数・はじめて来た端末・ホーム画面から開いた端末・回数（日ごとの kh_days と、時間ごとの kh_hours を合わせて）。
create view public.kh_stats with (security_invoker = true) as
with per_day as (
  select device, day, bool_or(standalone) as standalone,
         sum(opens) as opens, sum(collects) as collects, sum(reads) as reads
  from (
    select device, hour::date as day, opens, collects, reads, standalone from public.kh_hours
    union all
    select device, day, opens, collects, reads, standalone from public.kh_days
  ) u
  group by device, day
), firsts as (
  select device, min(day) as first_day from per_day group by device
)
select
  p.day,
  count(*) as devices,
  count(*) filter (where p.day = f.first_day) as new_devices,
  count(*) filter (where p.standalone) as from_home,
  sum(p.opens)::bigint as opens,
  sum(p.collects)::bigint as collects,
  sum(p.reads)::bigint as reads
from per_day p
join firsts f using (device)
group by p.day
order by p.day desc;

-- これまで・きょう・この7日・この30日の端末の数（同じ端末は1台。日本の日付で）。
create view public.kh_summary with (security_invoker = true) as
with u as (
  select device, hour::date as day, standalone from public.kh_hours
  union all
  select device, day, standalone from public.kh_days
), t as (
  select (now() at time zone 'Asia/Tokyo')::date as today
)
select
  count(distinct u.device) as devices_all,
  count(distinct u.device) filter (where u.day = t.today) as devices_today,
  count(distinct u.device) filter (where u.day > t.today - 7) as devices_7d,
  count(distinct u.device) filter (where u.day > t.today - 7 and u.standalone) as from_home_7d,
  count(distinct u.device) filter (where u.day > t.today - 30) as devices_30d,
  count(distinct u.device) filter (where u.day > t.today - 30 and u.standalone) as from_home_30d
from u
cross join t;

-- 初めて来た日ごとに、次の日・2日後・3日後・7日後と、その後のいずれかの日にまた来た端末の数（戻ってきたか）。
-- 日の区切りは朝4時：夜に来て日付をまたいで使い続けた人を、「次の日に戻ってきた」と数えないため。そのため、初めて来た日の
-- 端末の数は、0時で区切る日ごとのまとめ（kh_stats）の「はじめて」と少し違う。1時間ごとに数えはじめる前（kh_days）の分は、
-- 0時で区切った日のまま。その日がまだ来ていなければ null（きょうの分は途中の数）。
create view public.kh_cohorts with (security_invoker = true) as
with active as (
  select device, (hour - interval '4 hours')::date as day from public.kh_hours
  union
  select device, day from public.kh_days
), firsts as (
  select device, min(day) as first_day from active group by device
), t as (
  select ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date as today
)
select
  f.first_day,
  count(distinct f.device) as devices,
  case when f.first_day + 1 <= t.today then count(distinct a.device) filter (where a.day = f.first_day + 1) end as back_1,
  case when f.first_day + 2 <= t.today then count(distinct a.device) filter (where a.day = f.first_day + 2) end as back_2,
  case when f.first_day + 3 <= t.today then count(distinct a.device) filter (where a.day = f.first_day + 3) end as back_3,
  case when f.first_day + 7 <= t.today then count(distinct a.device) filter (where a.day = f.first_day + 7) end as back_7,
  count(distinct a.device) as back_any
from firsts f
left join active a on a.device = f.device and a.day > f.first_day
cross join t
group by f.first_day, t.today
order by f.first_day desc;

revoke all on public.kh_cohorts from public, anon, authenticated;
revoke all on public.kh_hourly from public, anon, authenticated;
revoke all on public.kh_stats from public, anon, authenticated;
revoke all on public.kh_summary from public, anon, authenticated;

-- 新しい表とまとめを、すぐ scripts/usage.mjs から読めるように（Supabase の API に作り直したことを知らせる）。
notify pgrst, 'reload schema';
