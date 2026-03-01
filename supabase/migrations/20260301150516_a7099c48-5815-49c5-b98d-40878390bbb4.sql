
-- Fix: "Admin full access" policy on profiles references user_metadata which is insecure.
-- Replace with a check against the profiles table itself using a security definer function.

-- First create a helper function to check admin role safely
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Recreate the Admin full access policy without user_metadata reference
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;

CREATE POLICY "Admin full access"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid()) OR auth.uid() = user_id
  );
