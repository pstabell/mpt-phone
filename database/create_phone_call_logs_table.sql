-- Create phone_call_logs table for MPT Phone
CREATE TABLE IF NOT EXISTS phone_call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    duration INTEGER DEFAULT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ringing', 'connected', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_created_at ON phone_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_status ON phone_call_logs(status);

-- Enable Row Level Security
ALTER TABLE phone_call_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (for now, allow all operations)
-- In production, you might want to restrict this further
CREATE POLICY "Allow all operations for authenticated users" ON phone_call_logs
    FOR ALL USING (true);