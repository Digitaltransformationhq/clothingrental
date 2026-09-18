-- ═══════════════════════════════════════════════════════════════════════════
-- Almirah — drop everything in "public" so setup.sql can run from clean.
--
--   ⚠ DESTRUCTIVE. This deletes every table, type, function and trigger in
--   the "public" schema, and all data in them. There is no undo.
--
-- Run this ONLY when verify.sql reports INCOMPLETE — that is, a previous
-- setup.sql run committed part-way and left objects behind, so re-running
-- setup.sql fails with errors like:
--
--     ERROR: 42710: type "UserRole" already exists
--
-- Do NOT run it when verify.sql reports every row "ok": that database is
-- correctly set up, and this would throw away a working schema (and, once you
-- have members and listings, their data).
--
-- Safe on a fresh Supabase project, where "public" holds nothing but Almirah's
-- own tables. Supabase keeps its own machinery in the auth, storage, realtime
-- and extensions schemas, which this does not touch.
--
-- Afterwards: run setup.sql, then `npm run db:provision`.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore the ownership and grants a Supabase project expects on a fresh
-- "public". Dropping the schema took these with it, and PostgREST's roles need
-- USAGE to exist as grantees even though setup.sql immediately revokes their
-- table privileges again.
ALTER SCHEMA public OWNER TO postgres;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. "public" is now empty. Run setup.sql next.
-- ═══════════════════════════════════════════════════════════════════════════
