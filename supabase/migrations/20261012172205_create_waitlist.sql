-- Run once as postgres (Supabase SQL Editor) or with `supabase db push`.
-- No existing application tables, grants or data are changed.
begin;

create schema parlonsmoi_private;
revoke all on schema parlonsmoi_private from public, anon, authenticated, service_role;
grant usage on schema parlonsmoi_private to service_role;

create table parlonsmoi_private.waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  country text not null,
  french_level text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_name_check check (char_length(full_name) between 2 and 100 and full_name = btrim(full_name) and full_name !~ '[[:cntrl:]]'),
  constraint waitlist_email_check check (
    char_length(email) <= 254 and char_length(split_part(email, '@', 1)) <= 64
    and email = lower(btrim(email))
    and email ~ $email$^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$$email$
  ),
  constraint waitlist_country_check check (country = any(array[
    'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
    'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
    'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
    'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR',
    'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
    'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
    'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
    'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
    'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM',
    'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
    'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
    'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ',
    'VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW'
  ]::text[])),
  constraint waitlist_level_check check (french_level in ('A0','A1','A2','B1','B2','C1','C2','native')),
  constraint waitlist_email_unique unique (email)
);
create index waitlist_created_at_idx on parlonsmoi_private.waitlist (created_at desc);

create function parlonsmoi_private.normalize_waitlist()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.full_name := regexp_replace(btrim(new.full_name), '[[:space:]]+', ' ', 'g');
  new.email := lower(btrim(new.email));
  new.country := upper(btrim(new.country));
  return new;
end;
$$;
revoke all on function parlonsmoi_private.normalize_waitlist() from public, anon, authenticated, service_role;
create trigger normalize_waitlist_before_write before insert or update on parlonsmoi_private.waitlist
for each row execute function parlonsmoi_private.normalize_waitlist();

create table parlonsmoi_private.waitlist_limits (
  bucket_key text not null check (bucket_key = 'global' or bucket_key ~ '^email:[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 101),
  primary key (bucket_key, window_start)
);
create index waitlist_limits_expiry_idx on parlonsmoi_private.waitlist_limits(window_start);

alter table parlonsmoi_private.waitlist enable row level security;
alter table parlonsmoi_private.waitlist force row level security;
alter table parlonsmoi_private.waitlist_limits enable row level security;
alter table parlonsmoi_private.waitlist_limits force row level security;
-- Intentionally no browser-facing RLS policies. service_role bypasses RLS,
-- but it must still have the explicitly limited object privileges below.
revoke all on parlonsmoi_private.waitlist from public, anon, authenticated, service_role;
revoke all on parlonsmoi_private.waitlist_limits from public, anon, authenticated, service_role;
grant insert (full_name, email, country, french_level), select (email)
  on parlonsmoi_private.waitlist to service_role;
grant select, insert, update, delete on parlonsmoi_private.waitlist_limits to service_role;

create function public.register_waitlist(
  p_full_name text, p_email text, p_country text, p_french_level text, p_email_hash text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  bucket_time timestamptz := date_bin(interval '15 minutes', statement_timestamp(), timestamptz '2000-01-01 00:00:00+00');
  count_now integer;
begin
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid request' using errcode = '22023';
  end if;

  -- No raw IPs or emails in limit records. Old buckets are pruned on traffic.
  delete from parlonsmoi_private.waitlist_limits where window_start < statement_timestamp() - interval '1 hour';

  insert into parlonsmoi_private.waitlist_limits as limits(bucket_key, window_start, attempts)
    values ('global', bucket_time, 1)
    on conflict (bucket_key, window_start) do update set attempts = least(limits.attempts + 1, 101)
    returning attempts into count_now;
  if count_now > 100 then return 'rate_limited'; end if;

  insert into parlonsmoi_private.waitlist_limits as limits(bucket_key, window_start, attempts)
    values ('email:' || p_email_hash, bucket_time, 1)
    on conflict (bucket_key, window_start) do update set attempts = least(limits.attempts + 1, 101)
    returning attempts into count_now;
  if count_now > 3 then return 'rate_limited'; end if;

  insert into parlonsmoi_private.waitlist(full_name, email, country, french_level)
    values (p_full_name, p_email, p_country, p_french_level)
    on conflict (email) do nothing;
  -- No SELECT/RETURNING of registration data, and no distinction on conflict.
  return 'accepted';
end;
$$;
-- Functions can have PUBLIC/default EXECUTE grants: explicitly remove them.
revoke all on function public.register_waitlist(text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.register_waitlist(text,text,text,text,text) to service_role;

comment on table parlonsmoi_private.waitlist is 'Private early-community registrations. Do not expose this schema via the Data API or Realtime.';
comment on function public.register_waitlist(text,text,text,text,text) is 'Server-only signup RPC. Must only be called after server-verified Turnstile. Returns identical result for new and duplicate registrations.';

commit;
