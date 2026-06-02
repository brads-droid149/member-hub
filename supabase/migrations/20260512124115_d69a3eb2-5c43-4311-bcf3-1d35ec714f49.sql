-- ============================================================================
-- NO-OP MIGRATION
-- ============================================================================
-- This migration previously seeded 20 fake test users (with a shared hashed
-- password "TestPassword123!") directly into auth.users on every
-- `supabase db push`, including production. That seed data has been moved to
-- `supabase/seed.sql`, which is applied only to local Supabase instances via
-- `supabase db reset` and is NOT pushed to production.
--
-- The migration file is kept (as a no-op) so its entry in
-- supabase_migrations.schema_migrations is preserved on environments where it
-- already ran. Any test users created by the old version of this migration in
-- production must be removed manually from the Supabase dashboard.
-- ============================================================================

SELECT 1;
