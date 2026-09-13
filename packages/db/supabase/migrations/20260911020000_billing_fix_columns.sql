-- Fix platform_invoices columns to match mutualized schema
ALTER TABLE public.platform_invoices ADD COLUMN IF NOT EXISTS total_events INTEGER DEFAULT 0;
ALTER TABLE public.platform_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.platform_invoices ADD COLUMN IF NOT EXISTS paid_amount BIGINT;

-- Sync total_students → total_events if empty
UPDATE public.platform_invoices SET total_events = total_students WHERE total_events = 0 AND total_students > 0;
