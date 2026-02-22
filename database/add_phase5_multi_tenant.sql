-- Phase 5: Multi-Tenant Enterprise Features
-- Add multi-tenant support with extensions, presence, and admin management

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    phone_number VARCHAR(20), -- Main company number
    max_extensions INTEGER DEFAULT 100,
    plan_type VARCHAR(50) DEFAULT 'enterprise' CHECK (plan_type IN ('basic', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}', -- Tenant-specific settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant_users table
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager')),
    is_active BOOLEAN DEFAULT TRUE,
    auth_user_id UUID, -- Reference to auth.users if using Supabase auth
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Create extensions table
CREATE TABLE IF NOT EXISTS extensions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    extension_number VARCHAR(10) NOT NULL, -- e.g., "101", "102"
    user_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
    extension_name VARCHAR(255), -- Display name for extension
    direct_dial_number VARCHAR(20), -- DID number if available
    voicemail_enabled BOOLEAN DEFAULT TRUE,
    call_forwarding_number VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, extension_number)
);

-- Create user_presence table for real-time presence indicators
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE,
    extension_id UUID REFERENCES extensions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'dnd', 'offline')),
    status_message VARCHAR(255),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create internal_calls table for extension-to-extension calls
CREATE TABLE IF NOT EXISTS internal_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    from_extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL,
    to_extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL,
    conference_sid VARCHAR(100), -- Twilio conference SID for internal call
    status VARCHAR(20) NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'completed', 'failed')),
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Add tenant_id to existing tables for multi-tenant support
ALTER TABLE phone_call_logs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL;

ALTER TABLE voicemails 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL;

ALTER TABLE call_recordings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE sms_messages 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL;

ALTER TABLE call_forwarding_rules 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES extensions(id) ON DELETE CASCADE;

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE;

ALTER TABLE favorites 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE;

ALTER TABLE conference_calls 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);
CREATE INDEX IF NOT EXISTS idx_extensions_tenant_id ON extensions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extensions_number ON extensions(tenant_id, extension_number);
CREATE INDEX IF NOT EXISTS idx_extensions_user_id ON extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_tenant_id ON user_presence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_internal_calls_tenant_id ON internal_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_calls_status ON internal_calls(status);

-- Add tenant_id indexes to existing tables
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_tenant_id ON phone_call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_extension_id ON phone_call_logs(extension_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_tenant_id ON voicemails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_extension_id ON voicemails(extension_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_id ON sms_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_extension_id ON sms_messages(extension_id);

-- Enable RLS for new tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_calls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY "Users can only access their tenant's data" ON tenants
    FOR ALL USING (
        id IN (
            SELECT tenant_id 
            FROM tenant_users 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only access their tenant's users" ON tenant_users
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_users 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only access their tenant's extensions" ON extensions
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_users 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only access their tenant's presence" ON user_presence
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_users 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can only access their tenant's internal calls" ON internal_calls
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM tenant_users 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Update RLS policies for existing tables to include tenant isolation
-- (Note: In production, you might want to update existing policies instead of creating new ones)

-- Add updated_at triggers for new tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at BEFORE UPDATE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extensions_updated_at BEFORE UPDATE ON extensions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default tenant for existing data migration
INSERT INTO tenants (id, name, slug, phone_number, is_active) 
VALUES (
    'default-tenant-' || gen_random_uuid()::text,
    'Metro Point Technology',
    'mpt-default',
    '+12394267058',
    true
) ON CONFLICT (slug) DO NOTHING;

-- Create a default admin user (you'll need to update this with actual user details)
INSERT INTO tenant_users (tenant_id, email, first_name, last_name, role, is_active)
SELECT 
    id,
    'admin@metropointtech.com',
    'Admin',
    'User',
    'admin',
    true
FROM tenants 
WHERE slug = 'mpt-default'
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Create some default extensions for the default tenant
INSERT INTO extensions (tenant_id, extension_number, extension_name, is_active)
SELECT 
    t.id,
    ext_num,
    'Extension ' || ext_num,
    true
FROM tenants t, 
     (VALUES ('100'), ('101'), ('102'), ('103'), ('104'), ('105')) AS ext(ext_num)
WHERE t.slug = 'mpt-default'
ON CONFLICT (tenant_id, extension_number) DO NOTHING;