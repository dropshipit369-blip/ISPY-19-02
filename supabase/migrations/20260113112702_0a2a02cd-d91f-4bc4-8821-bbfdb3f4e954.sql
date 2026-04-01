-- Fix scan_feedback RLS policy - users should only view their own feedback
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view feedback for learning" ON public.scan_feedback;

-- Create a proper policy that restricts users to only their own feedback
CREATE POLICY "Users can view their own feedback" ON public.scan_feedback
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Add admin policy for scan_feedback so admins can view all for analytics
CREATE POLICY "Admins can view all feedback" ON public.scan_feedback
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));