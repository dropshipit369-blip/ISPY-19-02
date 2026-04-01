-- Add DELETE policy for market_reports so users can clean up their own reports
CREATE POLICY "Users can delete reports for their items" ON public.market_reports
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM items 
  WHERE items.id = market_reports.item_id 
  AND items.user_id = auth.uid()
));

-- Add admin DELETE policy for market_reports
CREATE POLICY "Admins can delete all market reports" ON public.market_reports
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));