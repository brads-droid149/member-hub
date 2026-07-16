
DO $$
DECLARE new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'steve@surftag.au',
    crypt('SurfTag123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Steve'),
    now(), now(), '', '', '', ''
  );

  UPDATE public.profiles SET full_name = 'Steve' WHERE user_id = new_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, full_name) VALUES (new_user_id, 'Steve');
  END IF;

  INSERT INTO public.members (user_id, status, entries, months_active, billing_exempt, draw_exempt)
  VALUES (new_user_id, 'active', 0, 0, true, true);
END $$;
