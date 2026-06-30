ALTER TABLE public.members RENAME COLUMN exempt_from_winning TO draw_exempt;
ALTER TABLE public.members RENAME COLUMN is_exempt TO billing_exempt;

DROP FUNCTION IF EXISTS public.get_admin_members_overview();

CREATE OR REPLACE FUNCTION public.get_admin_members_overview()
 RETURNS TABLE(user_id uuid, full_name text, email text, phone text, state text, status text, entries integer, months_active integer, joined_at timestamp with time zone, draw_exempt boolean, billing_exempt boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
    m.status,
    m.entries,
    m.months_active,
    m.created_at,
    m.draw_exempt,
    m.billing_exempt
  FROM public.members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  ORDER BY m.created_at DESC;
END;
$function$;