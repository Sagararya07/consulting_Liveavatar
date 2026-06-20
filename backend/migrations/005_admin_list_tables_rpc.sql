-- Phase 4b: SQL helper for the admin panel's Database viewer.
-- Run in Supabase SQL editor once. After this, GET /admin/db/tables will
-- automatically enumerate every application table in your project — no
-- Python changes needed when you add a new table.
--
-- Safe to re-run.

create or replace function public.admin_list_tables()
returns table (table_schema text, table_name text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    t.table_schema::text,
    t.table_name::text
  from information_schema.tables t
  where t.table_type = 'BASE TABLE'
    and t.table_schema not in ('pg_catalog', 'information_schema')
    and t.table_schema not like 'pg_toast%'
    and t.table_schema not in ('auth', 'storage', 'realtime', 'extensions', 'graphql', 'graphql_public', 'net', 'vault', 'supabase_functions')
  order by t.table_schema, t.table_name;
$$;

-- Only the service role (used by the backend) should be able to call this.
revoke all on function public.admin_list_tables() from public;
grant execute on function public.admin_list_tables() to service_role;