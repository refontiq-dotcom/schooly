-- Grant permissions to service_role
GRANT ALL ON public.billing_configs TO service_role;
GRANT ALL ON public.subscription_payment_requests TO service_role;
GRANT ALL ON public.platform_fee_ledger TO service_role;
GRANT ALL ON public.platform_invoices TO service_role;

-- Ensure sequences are accessible
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
