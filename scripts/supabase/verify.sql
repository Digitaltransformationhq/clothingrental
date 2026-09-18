-- ═══════════════════════════════════════════════════════════════════════════
-- Almirah — what state is this database in?
--
-- Read-only. Changes nothing. Run it in the Supabase SQL Editor whenever you
-- are unsure whether `setup.sql` has been applied, or applied only in part.
--
-- Each row compares what is present against what a complete `setup.sql` run
-- produces. The "verdict" column is the one to read.
-- ═══════════════════════════════════════════════════════════════════════════

WITH expected(label, n) AS (
  VALUES
    ('tables',           41),
    ('enum types',       29),
    ('indexes',         143),
    ('foreign keys',     54),
    ('check constraints', 23),
    ('triggers',          2),
    ('functions',         2),
    ('migration rows',    2)
),
actual(label, n) AS (
  SELECT 'tables',
         count(*)::int FROM pg_tables
         WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  UNION ALL
  SELECT 'enum types',
         count(*)::int FROM pg_type t
         JOIN pg_namespace ns ON ns.oid = t.typnamespace
         WHERE ns.nspname = 'public' AND t.typtype = 'e'
  UNION ALL
  SELECT 'indexes',
         count(*)::int FROM pg_indexes
         WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  UNION ALL
  SELECT 'foreign keys',
         count(*)::int FROM pg_constraint c
         JOIN pg_namespace ns ON ns.oid = c.connamespace
         WHERE ns.nspname = 'public' AND c.contype = 'f'
  UNION ALL
  SELECT 'check constraints',
         count(*)::int FROM pg_constraint c
         JOIN pg_namespace ns ON ns.oid = c.connamespace
         WHERE ns.nspname = 'public' AND c.contype = 'c'
           AND c.conname LIKE '%\_%' AND c.conname NOT LIKE '%\_not\_null'
  UNION ALL
  -- Scoped to "public": a Supabase project has its own triggers in the auth,
  -- storage and realtime schemas, and counting those would mask a partial run.
  SELECT 'triggers',
         count(*)::int FROM pg_trigger tg
         JOIN pg_class cl ON cl.oid = tg.tgrelid
         JOIN pg_namespace ns ON ns.oid = cl.relnamespace
         WHERE ns.nspname = 'public' AND NOT tg.tgisinternal
  UNION ALL
  SELECT 'functions',
         count(*)::int FROM pg_proc p
         JOIN pg_namespace ns ON ns.oid = p.pronamespace
         WHERE ns.nspname = 'public' AND p.proname LIKE 'almirah\_%'
  UNION ALL
  -- Counted through query_to_xml so the whole statement still runs when
  -- "_prisma_migrations" does not exist yet. A plain subquery against a
  -- missing table fails at parse time, before any CASE or COALESCE around it
  -- can help, which would make this script unusable on an empty database --
  -- exactly the case it most needs to report on. The WHERE keeps query_to_xml
  -- from being evaluated at all when the table is absent.
  SELECT 'migration rows',
         COALESCE((
           SELECT (xpath('/row/c/text()',
                    query_to_xml('SELECT count(*) AS c FROM public."_prisma_migrations"',
                                 false, true, '')))[1]::text::int
           FROM (SELECT to_regclass('public._prisma_migrations') AS reg) r
           WHERE r.reg IS NOT NULL
         ), 0)
)
SELECT
  e.label,
  e.n  AS expected,
  a.n  AS present,
  CASE
    WHEN a.n = 0    THEN 'absent      -- nothing created yet'
    WHEN a.n < e.n  THEN 'INCOMPLETE  -- partial run, needs reset.sql'
    WHEN a.n = e.n  THEN 'ok'
    ELSE                 'more than expected -- extra objects present'
  END AS verdict
FROM expected e
JOIN actual a USING (label)
ORDER BY e.label;

-- ── How to read the result ─────────────────────────────────────────────────
--
--  Every row "ok"          Setup is complete. Do NOT run setup.sql again.
--                          Go straight to `npm run db:provision`.
--
--  Every row "absent"      Nothing has been created. Run setup.sql.
--
--  Anything "INCOMPLETE"   A previous run committed part-way. Run reset.sql
--  or a mix of states      first (it drops everything), then setup.sql.
--
-- "migration rows" is the honest completion marker: it is written by the very
-- last statement in setup.sql, so 2 there means the run reached the end.
-- ═══════════════════════════════════════════════════════════════════════════
