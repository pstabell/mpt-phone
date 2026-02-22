-- Phase 3: CRM Integration and SMS Features
-- Add CRM integration columns to phone_call_logs

-- Add contact_name column to phone_call_logs if it doesn't exist
ALTER TABLE phone_call_logs
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);

-- Create SMS messages table
CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered')),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    message_sid VARCHAR(100) NOT NULL,
    error_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for SMS messages
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_contact_id ON sms_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_number ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_message_sid ON sms_messages(message_sid);

-- Enable RLS for SMS messages
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for SMS messages
CREATE POLICY "Allow all operations for authenticated users" ON sms_messages
    FOR ALL USING (true);

-- Add updated_at trigger for SMS messages
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sms_messages_updated_at BEFORE UPDATE ON sms_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();