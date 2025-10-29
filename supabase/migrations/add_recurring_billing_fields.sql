-- Add fields to support recurring billing and invoice generation
-- This migration adds necessary fields to track pending invoices and billing cycles

-- Add fields to payment_receipts for invoice tracking
ALTER TABLE payment_receipts
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

-- Add indexes for invoice queries
CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_number ON payment_receipts(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_next_billing ON payment_receipts(next_billing_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_receipts_is_recurring ON payment_receipts(is_recurring) WHERE is_recurring = true;

-- Add comments
COMMENT ON COLUMN payment_receipts.invoice_number IS 'Unique identifier for recurring invoices';
COMMENT ON COLUMN payment_receipts.is_recurring IS 'Indicates if this is a recurring subscription payment';
COMMENT ON COLUMN payment_receipts.next_billing_date IS 'Due date for recurring billing invoices';

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV-';
  year TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  month TEXT := TO_CHAR(CURRENT_DATE, 'MM');
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-\d{4}-\d{2}-(\d+)') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM payment_receipts
  WHERE invoice_number LIKE prefix || year || '-' || month || '-%';
  
  -- Generate the invoice number
  invoice_num := prefix || year || '-' || month || '-' || LPAD(sequence_num::TEXT, 6, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate invoice numbers for recurring payments
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_recurring = true AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number_trigger
  BEFORE INSERT ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

