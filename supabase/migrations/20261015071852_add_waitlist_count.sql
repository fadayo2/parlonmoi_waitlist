begin;
create function public.get_waitlist_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $function$
  select count(email) from parlonsmoi_private.waitlist;
$function$;
revoke all on function public.get_waitlist_count() from public, anon, authenticated, service_role;
grant execute on function public.get_waitlist_count() to service_role;
comment on function public.get_waitlist_count() is 'Server-only aggregate for waitlist-stats. No arguments, no personal data, no extra table grants.';
commit;
