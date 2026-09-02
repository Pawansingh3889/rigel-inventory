-- Create missing company and profile records for existing user
DO $$
DECLARE
    user_record RECORD;
    new_company_id UUID;
BEGIN
    -- Get the user data
    SELECT id, raw_user_meta_data INTO user_record 
    FROM auth.users 
    WHERE email = 'kapkotirudhvik@gmail.com';
    
    IF user_record.id IS NOT NULL THEN
        -- Create company record
        INSERT INTO public.companies (
            name, 
            email,
            phone,
            city,
            state,
            country,
            address
        ) VALUES (
            user_record.raw_user_meta_data ->> 'company_name',
            user_record.raw_user_meta_data ->> 'email',
            user_record.raw_user_meta_data ->> 'phone',
            user_record.raw_user_meta_data ->> 'city',
            user_record.raw_user_meta_data ->> 'state',
            user_record.raw_user_meta_data ->> 'country',
            CONCAT(
                COALESCE(user_record.raw_user_meta_data ->> 'city', ''), ', ',
                COALESCE(user_record.raw_user_meta_data ->> 'state', ''), ', ',
                COALESCE(user_record.raw_user_meta_data ->> 'country', '')
            )
        ) RETURNING id INTO new_company_id;
        
        -- Create profile record
        INSERT INTO public.profiles (
            user_id,
            company_id,
            first_name,
            last_name,
            phone,
            city,
            state,
            country,
            role
        ) VALUES (
            user_record.id,
            new_company_id,
            user_record.raw_user_meta_data ->> 'first_name',
            user_record.raw_user_meta_data ->> 'last_name',
            user_record.raw_user_meta_data ->> 'phone',
            user_record.raw_user_meta_data ->> 'city',
            user_record.raw_user_meta_data ->> 'state',
            user_record.raw_user_meta_data ->> 'country',
            'owner'
        );
        
        RAISE NOTICE 'Created company % and profile for user %', new_company_id, user_record.id;
    END IF;
END $$;