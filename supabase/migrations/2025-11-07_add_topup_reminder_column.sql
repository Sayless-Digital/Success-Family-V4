-- Track when wallet top-up reminders are sent
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS last_topup_reminder_at TIMESTAMPTZ;









