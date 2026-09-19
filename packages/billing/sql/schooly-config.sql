-- Configuration Schooly (mode event_based)
-- À jouer dans Supabase SQL Editor ou via migration

INSERT INTO billing_configs (
  product_id,
  name,
  mode,
  currency,
  event_amount,
  event_types,
  wave_merchant_id,
  wave_webhook_secret,
  telegram_bot_token,
  telegram_chat_id,
  telegram_admin_url,
  is_active
) VALUES (
  'schooly',
  'Schooly',
  'event_based',
  'XOF',
  1000,
  '["enrollment_confirmed"]'::jsonb,
  '<configure-in-secure-environment>',
  NULL,
  NULL,
  NULL,
  'https://admin.schooly.ci/billing',
  true
)
ON CONFLICT (product_id) DO UPDATE SET
  name = EXCLUDED.name,
  mode = EXCLUDED.mode,
  currency = EXCLUDED.currency,
  event_amount = EXCLUDED.event_amount,
  event_types = EXCLUDED.event_types,
  wave_merchant_id = EXCLUDED.wave_merchant_id,
  wave_webhook_secret = EXCLUDED.wave_webhook_secret,
  telegram_bot_token = EXCLUDED.telegram_bot_token,
  telegram_chat_id = EXCLUDED.telegram_chat_id,
  telegram_admin_url = EXCLUDED.telegram_admin_url,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

SELECT * FROM billing_configs WHERE product_id = 'schooly';
