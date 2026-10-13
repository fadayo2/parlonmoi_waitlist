-- Read-only checks, run as postgres in the Supabase SQL Editor after migration.
-- Every result in the assertion block must pass; no registration data is read.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if has_schema_privilege(r, 'parlonsmoi_private', 'USAGE') then
      raise exception 'FAIL: % can use the private schema', r;
    end if;
    if has_any_column_privilege(r, 'parlonsmoi_private.waitlist', 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege(r, 'parlonsmoi_private.waitlist', 'DELETE,TRUNCATE,TRIGGER') then
      raise exception 'FAIL: % has registration privileges', r;
    end if;
    if has_table_privilege(r, 'parlonsmoi_private.waitlist_limits', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'FAIL: % has limit-table privileges', r;
    end if;
    if has_function_privilege(r, 'public.register_waitlist(text,text,text,text,text)', 'EXECUTE') then
      raise exception 'FAIL: % can bypass the Edge Function', r;
    end if;
  end loop;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='parlonsmoi_private' and c.relname in ('waitlist','waitlist_limits')
      and c.relrowsecurity and c.relforcerowsecurity) <> 2 then
    raise exception 'FAIL: both tables must enforce RLS';
  end if;
  if not has_function_privilege('service_role', 'public.register_waitlist(text,text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: server role cannot execute signup';
  end if;
  if not (select rolbypassrls from pg_roles where rolname='service_role') then
    raise exception 'FAIL: expected Supabase service_role BYPASSRLS capability';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='register_waitlist' and p.prosecdef) then
    raise exception 'FAIL: signup RPC must be SECURITY INVOKER';
  end if;
  raise notice 'PASS: private schema, browser grants, RLS and RPC access assertions';
end;
$$;

select grantee, privilege_type from information_schema.routine_privileges
where routine_schema='public' and routine_name='register_waitlist';
select grantee, column_name, privilege_type from information_schema.column_privileges
where table_schema='parlonsmoi_private' and table_name='waitlist'
order by grantee, column_name, privilege_type;
