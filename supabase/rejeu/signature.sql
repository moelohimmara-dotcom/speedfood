-- Signature du schema public : memes requetes pour la base rejouee et pour la
-- production, a comparer ligne a ligne. Exclut ce que Supabase fournit
-- (rls_auto_enable, schemas auth/storage) et les contraintes NOT NULL (PostgreSQL 18
-- les expose dans pg_constraint, pas PostgreSQL 17). Les corps de fonctions sont
-- compares sans commentaires, fins de ligne ni espaces.
select 'tables' as k, count(*)::int as n, md5(string_agg(c.relname || ':' || c.relrowsecurity::text, ',' order by c.relname)) as h
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind = 'r'
union all
select 'colonnes', count(*)::int, md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), ',' order by table_name, column_name))
  from information_schema.columns where table_schema = 'public'
union all
select 'contraintes', count(*)::int, md5(string_agg(conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid), ',' order by conrelid::regclass::text, conname))
  from pg_constraint where connamespace = 'public'::regnamespace and contype <> 'n'
union all
select 'index', count(*)::int, md5(string_agg(indexdef, ',' order by indexname))
  from pg_indexes where schemaname = 'public'
union all
select 'policies', count(*)::int, md5(string_agg(tablename || '.' || policyname || ':' || cmd || ':' || roles::text || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ',' order by tablename, policyname))
  from pg_policies where schemaname = 'public'
union all
select 'triggers', count(*)::int, md5(string_agg(tgrelid::regclass::text || '.' || tgname, ',' order by tgrelid::regclass::text, tgname))
  from pg_trigger where not tgisinternal and tgrelid::regclass::text in (select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r')
union all
select 'fonctions', count(*)::int, md5(string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || '):' || prosecdef::text || ':' ||
    md5(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '(^|' || chr(10) || ')[[:space:]]*--[^' || chr(10) || ']*', '', 'g'), '[[:space:]]+', '', 'g')),
    ',' order by proname, pg_get_function_identity_arguments(oid)))
  from pg_proc where pronamespace = 'public'::regnamespace and proname <> 'rls_auto_enable'
