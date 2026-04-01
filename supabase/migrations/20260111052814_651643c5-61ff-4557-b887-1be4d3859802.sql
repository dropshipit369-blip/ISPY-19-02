-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view feedback for learning" ON public.scan_feedback;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view feedback for learning"
ON public.scan_feedback
FOR SELECT
USING (auth.role() = 'authenticated');