import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface PhoneCallLog {
  id?: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  duration?: number;
  status: 'ringing' | 'connected' | 'completed' | 'failed';
  created_at?: string;
}

// Phase 3: CRM Contact interface
export interface CrmContact {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Phase 3: SMS Message interface  
export interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  contact_id?: string;
  message_sid: string;
  created_at: string;
}