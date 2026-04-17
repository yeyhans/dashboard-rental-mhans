-- Fix: Admins can read and update ALL user_profiles
-- Root cause: SUPABASE_SERVICE_ROLE_KEY on VPS doesn't bypass RLS via PostgREST
-- Solution: explicit RLS policies based on admin_users table membership

CREATE POLICY "Admins can read all user_profiles"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()::text
  )
);

CREATE POLICY "Admins can update all user_profiles"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()::text
  )
);
