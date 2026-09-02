-- Create the missing profile for the user
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
)
VALUES (
  'b44a621d-a95c-4cb2-927d-fac2f0755914',
  '5e1edf56-c589-4312-b658-e66ff1ec1c72',
  'Girish',
  'kapkoti',
  '9821014216',
  'noida',
  'Uttar Pradesh',
  'India',
  'owner'
);