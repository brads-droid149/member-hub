-- Replace the unpaginated overview function with one that supports
-- server-side search, sort, and pagination. Keep the spelling split intact:
-- members.status remains AU spelling ('cancelled'), unchanged by this migration.

DROP FUNCTION IF EXISTS public.get_admin_members_overview();
DROP FUNCTION IF EXISTS public.get_admin_members_overview(text, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_admin_members_overview(
  _search    text    DEFAULT NULL,
  _limit     integer DEFAULT 50,
  _offset    integer DEFAULT 0,
  _sort_key  text    DEFAULT 'joined_at',
  _sort_dir  text    DEFAULT 'desc'
)
RETURNS TABLE(
  user_id        uuid,
  full_name      text,
  email          text,
  phone          text,
  state          text,
  status         text,
  entries        integer,
  months_active  integer,
  joined_at      timestamptz,
  draw_exempt    boolean,
  billing_exempt boolean,
  total_count    bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  q   text    := nullif(btrim(_search), '');
  lim integer := least(greatest(coalesce(_limit, 50), 1), 500);
  off integer := greatest(coalesce(_offset, 0), 0);
  sk  text    := lower(coalesce(_sort_key, 'joined_at'));
  sd  text    := lower(coalesce(_sort_dir, 'desc'));
  sort_col text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Whitelist sort key -> actual column expression to prevent injection.
  sort_col := CASE sk
    WHEN 'entries'       THEN 'entries'
    WHEN 'months_active' THEN 'months_active'
    WHEN 'full_name'     THEN 'full_name'
    WHEN 'email'         THEN 'email'
    WHEN 'status'        THEN 'status'
    ELSE 'joined_at'
  END;

  IF sd NOT IN ('asc', 'desc') THEN
    sd := 'desc';
  END IF;

  RETURN QUERY EXECUTE format(
    $f$
      WITH filtered AS (
        SELECT
          m.user_id,
          p.full_name,
          u.email::text AS email,
          p.phone,
          p.state,
          m.status,
          m.entries,
          m.months_active,
          m.created_at AS joined_at,
          m.draw_exempt,
          m.billing_exempt
        FROM public.members m
        LEFT JOIN public.profiles p ON p.user_id = m.user_id
        LEFT JOIN auth.users    u ON u.id      = m.user_id
        WHERE
          $1 IS NULL
          OR p.full_name      ILIKE '%%' || $1 || '%%'
          OR u.email::text    ILIKE '%%' || $1 || '%%'
          OR m.user_id::text  ILIKE        $1 || '%%'
      ), counted AS (
        SELECT f.*, count(*) OVER () AS total_count FROM filtered f
      )
      SELECT
        user_id, full_name, email, phone, state, status,
        entries, months_active, joined_at,
        draw_exempt, billing_exempt, total_count
      FROM counted
      ORDER BY %I %s NULLS LAST, user_id ASC
      LIMIT $2 OFFSET $3
    $f$,
    sort_col, sd
  ) USING q, lim, off;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_admin_members_overview(text, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_members_overview(text, integer, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_admin_members_overview(text, integer, integer, text, text) IS
  'Admin-only paginated members overview. Args: _search (ILIKE on name/email + prefix on user_id), _limit (1-500, default 50), _offset (default 0), _sort_key (joined_at|entries|months_active|full_name|email|status), _sort_dir (asc|desc). Each row carries total_count = full filtered count.';
