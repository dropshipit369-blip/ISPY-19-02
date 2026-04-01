-- Create index for faster Daily Analytics queries
CREATE INDEX IF NOT EXISTS idx_scan_logs_user_scanned_at 
ON public.scan_logs (user_id, scanned_at DESC);