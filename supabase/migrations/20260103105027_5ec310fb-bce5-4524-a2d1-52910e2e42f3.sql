-- Create feedback table for AI learning
CREATE TABLE public.scan_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scan_log_id UUID REFERENCES public.scan_logs(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  corrected_name TEXT,
  original_brand TEXT,
  corrected_brand TEXT,
  original_model TEXT,
  corrected_model TEXT,
  original_category TEXT,
  corrected_category TEXT,
  original_condition TEXT,
  corrected_condition TEXT,
  original_low_price NUMERIC,
  corrected_low_price NUMERIC,
  original_high_price NUMERIC,
  corrected_high_price NUMERIC,
  feedback_type TEXT NOT NULL DEFAULT 'correction', -- 'correction', 'confirmation', 'rejection'
  accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scan_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view all feedback (for AI learning)
CREATE POLICY "Anyone can view feedback for learning"
ON public.scan_feedback FOR SELECT
USING (true);

-- Users can create their own feedback
CREATE POLICY "Users can create their own feedback"
ON public.scan_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON public.scan_feedback FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for efficient querying
CREATE INDEX idx_scan_feedback_category ON public.scan_feedback(corrected_category);
CREATE INDEX idx_scan_feedback_brand ON public.scan_feedback(corrected_brand);
CREATE INDEX idx_scan_feedback_created ON public.scan_feedback(created_at DESC);