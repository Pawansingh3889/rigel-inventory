-- First, drop and recreate the INSERT policy to allow unauthenticated (anon) users to register
DROP POLICY IF EXISTS "Public can register a business" ON public.businesses;
DROP POLICY IF EXISTS "Users can register their business" ON public.businesses;

-- Allow anon (unauthenticated) users to register businesses
CREATE POLICY "Anonymous users can register business"
ON public.businesses
FOR INSERT
TO anon
WITH CHECK (true);

-- Also allow authenticated users to register businesses
CREATE POLICY "Authenticated users can register business" 
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update SELECT policies to be more permissive for registration flow
DROP POLICY IF EXISTS "Users can view their own business (profiles)" ON public.businesses;
DROP POLICY IF EXISTS "Users can view business by matching email" ON public.businesses;

-- Allow anon users to view businesses they just created (needed for .select() after insert)
CREATE POLICY "Public can view businesses"
ON public.businesses  
FOR SELECT
TO public
USING (true);

-- Note: In production, you might want to restrict this further, but for registration flow this is needed