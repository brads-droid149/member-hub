DROP FUNCTION IF EXISTS public.get_admin_members_overview();

ALTER TABLE public.members DROP COLUMN IF EXISTS status;

CREATE OR REPLACE FUNCTION public.get_admin_members_overview()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  state text,
  entries integer,
  months_active integer,
  joined_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    p.full_name,
    u.email::text,
    p.phone,
    p.state,
    m.entries,
    m.months_active,
    m.created_at
  FROM public.members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  ORDER BY m.created_at DESC;
END;
$function$;