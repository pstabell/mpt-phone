-- Phase 4: Advanced Call Features
-- Add tables and columns for Phase 4 features

-- Create call_forwarding_rules table
CREATE TABLE IF NOT EXISTS call_forwarding_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL DEFAULT 'default_user', -- For multi-user support later
    rule_name VARCHAR(100) NOT NULL,
    forward_to_number VARCHAR(20) NOT NULL,
    condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('no_answer', 'busy', 'always', 'after_rings')),
    ring_count INTEGER DEFAULT 4, -- For 'after_rings' condition
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table for DND and other settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL DEFAULT 'default_user',
    setting_key VARCHAR(50) NOT NULL,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- Create favorites table for speed dial
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL DEFAULT 'default_user',
    contact_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    company VARCHAR(255),
    speed_dial_position INTEGER, -- 1-9 for speed dial keys
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conference_calls table to track conference sessions
CREATE TABLE IF NOT EXISTS conference_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conference_name VARCHAR(100) NOT NULL UNIQUE,
    conference_sid VARCHAR(100) NOT NULL,
    initiator_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Create conference_participants table
CREATE TABLE IF NOT EXISTS conference_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conference_id UUID REFERENCES conference_calls(id) ON DELETE CASCADE,
    participant_number VARCHAR(20) NOT NULL,
    participant_name VARCHAR(255),
    call_sid VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('connected', 'disconnected')) DEFAULT 'connected'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_forwarding_rules_user_id ON call_forwarding_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_call_forwarding_rules_active ON call_forwarding_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON user_settings(user_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_speed_dial_position ON favorites(user_id, speed_dial_position);
CREATE INDEX IF NOT EXISTS idx_conference_calls_status ON conference_calls(status);
CREATE INDEX IF NOT EXISTS idx_conference_participants_conference_id ON conference_participants(conference_id);

-- Enable RLS for new tables
ALTER TABLE call_forwarding_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON call_forwarding_rules
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON user_settings
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON favorites
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON conference_calls
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON conference_participants
    FOR ALL USING (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_call_forwarding_rules_updated_at BEFORE UPDATE ON call_forwarding_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorites_updated_at BEFORE UPDATE ON favorites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default DND setting
INSERT INTO user_settings (user_id, setting_key, setting_value) 
VALUES ('default_user', 'do_not_disturb', 'false')
ON CONFLICT (user_id, setting_key) DO NOTHING;

-- Insert default call forwarding setting
INSERT INTO user_settings (user_id, setting_key, setting_value) 
VALUES ('default_user', 'call_forwarding_enabled', 'false')
ON CONFLICT (user_id, setting_key) DO NOTHING;