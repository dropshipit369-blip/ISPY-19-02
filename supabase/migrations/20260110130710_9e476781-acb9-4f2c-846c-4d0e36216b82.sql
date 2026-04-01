-- Add admin policies to items table
CREATE POLICY "Admins can view all items"
ON public.items
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all items"
ON public.items
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all items"
ON public.items
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies to scan_logs table
CREATE POLICY "Admins can view all scan logs"
ON public.scan_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies to market_reports table
CREATE POLICY "Admins can view all market reports"
ON public.market_reports
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies to profiles table
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies to user_subscriptions table
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all subscriptions"
ON public.user_subscriptions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));