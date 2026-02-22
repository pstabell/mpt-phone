-- Phase 2: Extend phone_call_logs table for Phase 2 features
-- Add columns for voicemails, recordings, and call notes

ALTER TABLE phone_call_logs
ADD COLUMN IF NOT EXISTS recording_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voicemail_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS voicemail_duration INTEGER,
ADD COLUMN IF NOT EXISTS voicemail_transcription TEXT,
ADD COLUMN IF NOT EXISTS call_notes TEXT,
ADD COLUMN IF NOT EXISTS disposition VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_voicemail BOOLEAN DEFAULT FALSE;

-- Create voicemails table for better organization
CREATE TABLE IF NOT EXISTS voicemails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_log_id UUID REFERENCES phone_call_logs(id) ON DELETE CASCADE,
    from_number VARCHAR(20) NOT NULL,
    recording_url VARCHAR(500) NOT NULL,
    duration INTEGER,
    transcription TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create call_recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_log_id UUID REFERENCES phone_call_logs(id) ON DELETE CASCADE,
    recording_url VARCHAR(500) NOT NULL,
    duration INTEGER,
    consent_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voicemails_created_at ON voicemails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemails_is_read ON voicemails(is_read);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_log_id ON call_recordings(call_log_id);

-- Enable RLS for new tables
ALTER TABLE voicemails ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON voicemails
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON call_recordings
    FOR ALL USING (true);

-- Add check constraint for disposition values
ALTER TABLE phone_call_logs
DROP CONSTRAINT IF EXISTS chk_disposition,
ADD CONSTRAINT chk_disposition CHECK (
    disposition IS NULL OR 
    disposition IN ('completed', 'follow_up_needed', 'wrong_number', 'no_answer', 'busy', 'interested', 'not_interested', 'callback_requested')
);