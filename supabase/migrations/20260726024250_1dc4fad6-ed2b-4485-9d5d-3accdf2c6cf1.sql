DO $$
BEGIN
  UPDATE auth.users
     SET encrypted_password = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf')),
         updated_at = now()
   WHERE email = 'steve@surftag.au';
END $$;