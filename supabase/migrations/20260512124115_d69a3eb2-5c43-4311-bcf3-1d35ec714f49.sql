
DO $$
DECLARE
  new_user_id uuid;
  surf_members text[][] := ARRAY[
    ARRAY['Kai Sutherland',     'kai.sutherland@test.surf',     '+61412345001', 'NSW', '1'],
    ARRAY['Jacko Fanning',      'jacko.fanning@test.surf',      '+61412345002', 'NSW', '2'],
    ARRAY['Mick Bartholomew',   'mick.bartholomew@test.surf',   '+61412345003', 'QLD', '3'],
    ARRAY['Layne Gilmore',      'layne.gilmore@test.surf',      '+61412345004', 'VIC', '4'],
    ARRAY['Stephanie Carroll',  'stephanie.carroll@test.surf',  '+61412345005', 'NSW', '5'],
    ARRAY['Tyler Wright',       'tyler.wright@test.surf',       '+61412345006', 'NSW', '6'],
    ARRAY['Owen Slater',        'owen.slater@test.surf',        '+61412345007', 'WA',  '7'],
    ARRAY['Sally Bailey',       'sally.bailey@test.surf',       '+61412345008', 'QLD', '8'],
    ARRAY['Wayne Lynch',        'wayne.lynch@test.surf',        '+61412345009', 'VIC', '9'],
    ARRAY['Nat Young',          'nat.young@test.surf',          '+61412345010', 'NSW', '10'],
    ARRAY['Taj Burrow',         'taj.burrow@test.surf',         '+61412345011', 'WA',  '11'],
    ARRAY['Joel Parko',         'joel.parko@test.surf',         '+61412345012', 'QLD', '12'],
    ARRAY['Bethany Andersen',   'bethany.andersen@test.surf',   '+61412345013', 'NSW', '1'],
    ARRAY['Ryan Callinan',      'ryan.callinan@test.surf',      '+61412345014', 'NSW', '3'],
    ARRAY['Connor OLeary',      'connor.oleary@test.surf',      '+61412345015', 'NSW', '5'],
    ARRAY['Macy Callaghan',     'macy.callaghan@test.surf',     '+61412345016', 'NSW', '7'],
    ARRAY['Isabella Nichols',   'isabella.nichols@test.surf',   '+61412345017', 'QLD', '4'],
    ARRAY['Ethan Ewing',        'ethan.ewing@test.surf',        '+61412345018', 'QLD', '6'],
    ARRAY['Jack Robinson',      'jack.robinson@test.surf',      '+61412345019', 'WA',  '8'],
    ARRAY['Molly Picklum',      'molly.picklum@test.surf',      '+61412345020', 'NSW', '2']
  ];
  i int;
  entries_val int;
BEGIN
  FOR i IN 1..array_length(surf_members, 1) LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = surf_members[i][2]) THEN
      CONTINUE;
    END IF;

    new_user_id := gen_random_uuid();
    entries_val := surf_members[i][5]::int;

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
      surf_members[i][2],
      crypt('TestPassword123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', surf_members[i][1], 'phone', surf_members[i][3], 'state', surf_members[i][4]),
      now(), now(), '', '', '', ''
    );

    -- Profile auto-created by handle_new_user trigger; ensure values are set
    UPDATE public.profiles
       SET full_name = surf_members[i][1],
           phone     = surf_members[i][3],
           state     = surf_members[i][4]
     WHERE user_id = new_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.profiles (user_id, full_name, phone, state)
      VALUES (new_user_id, surf_members[i][1], surf_members[i][3], surf_members[i][4]);
    END IF;

    INSERT INTO public.members (user_id, status, entries, months_active)
    VALUES (new_user_id, 'active', entries_val, entries_val);
  END LOOP;
END $$;
