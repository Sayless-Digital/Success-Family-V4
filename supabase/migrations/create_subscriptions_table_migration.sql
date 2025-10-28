-- Create subscriptions table for better subscription management
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX idx_subscriptions_community_id ON subscriptions(community_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_subscriptions_community_status ON subscriptions(community_id, status);

-- Add updated_at trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE subscriptions IS 'Tracks subscription periods for communities, allowing for history and recurring billing management';
COMMENT ON COLUMN subscriptions.status IS 'pending: awaiting first payment, active: paid and running, cancelled: will expire at end date, expired: past end date';
COMMENT ON COLUMN subscriptions.start_date IS 'When this subscription period started';
COMMENT ON COLUMN subscriptions.end_date IS 'When this subscription period ends (for cancelled or expired subscriptions)';
COMMENT ON COLUMN subscriptions.next_billing_date IS 'Next payment due date for active subscriptions';

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Community owners can view their subscriptions
CREATE POLICY "Community owners can view their subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM communities WHERE owner_id = auth.uid()
    )
  );

-- Only system can insert subscriptions (via payment verification)
CREATE POLICY "Only authenticated users can insert subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Community owners can update their subscription cancellation
CREATE POLICY "Community owners can cancel their subscriptions"
  ON subscriptions
  FOR UPDATE
  USING (
    community_id IN (
      SELECT id FROM communities WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT id FROM communities WHERE owner_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add subscription_id to payment_receipts
ALTER TABLE payment_receipts
ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE INDEX idx_payment_receipts_subscription_id ON payment_receipts(subscription_id);

COMMENT ON COLUMN payment_receipts.subscription_id IS 'Links payment to specific subscription period';

-- Migrate existing data: Create active subscriptions for active communities
INSERT INTO subscriptions (community_id, plan_id, billing_cycle, status, start_date, next_billing_date, created_at, updated_at)
SELECT 
  id as community_id,
  plan_id,
  billing_cycle,
  subscription_status,
  subscription_start_date,
  next_billing_date,
  created_at,
  updated_at
FROM communities
WHERE subscription_status IS NOT NULL;

-- Link existing verified payments to their subscriptions
UPDATE payment_receipts pr
SET subscription_id = s.id
FROM subscriptions s
WHERE pr.community_id = s.community_id
  AND pr.status = 'verified'
  AND s.status IN ('active', 'cancelled');