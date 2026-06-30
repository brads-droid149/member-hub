ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;
DROP INDEX IF EXISTS public.profiles_phone_unique_idx;
DROP FUNCTION IF EXISTS public.phone_exists(text);