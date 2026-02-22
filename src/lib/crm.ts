import { supabase, CrmContact } from './supabase';

/**
 * Phase 3: CRM Contact Lookup utilities
 */

// Format phone number for consistent lookups
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.startsWith('+')) {
    return phone;
  }
  
  return `+1${digits}`;
}

// Lookup contact by phone number
export async function lookupContactByPhone(phoneNumber: string): Promise<CrmContact | null> {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Try exact match first
    let { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', formattedPhone)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found", which is expected - other errors are real issues
      console.error('Error looking up contact:', error);
      return null;
    }

    if (data) {
      return data as CrmContact;
    }

    // If no exact match, try fuzzy match on just the digits
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    
    if (cleanDigits.length >= 10) {
      const searchPattern = cleanDigits.slice(-10); // Get last 10 digits
      
      ({ data, error } = await supabase
        .from('contacts')
        .select('*')
        .ilike('phone', `%${searchPattern}%`)
        .limit(1)
        .single());

      if (error && error.code !== 'PGRST116') {
        console.error('Error in fuzzy phone lookup:', error);
        return null;
      }

      if (data) {
        return data as CrmContact;
      }
    }

    return null;
  } catch (error) {
    console.error('Exception in contact lookup:', error);
    return null;
  }
}

// Get contact display name
export function getContactDisplayName(contact: CrmContact): string {
  if (contact.first_name || contact.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }
  return contact.company || contact.phone;
}

// Get contact summary for display during calls
export function getContactSummary(contact: CrmContact): string {
  const name = getContactDisplayName(contact);
  const parts = [name];
  
  if (contact.company && contact.company !== name) {
    parts.push(`(${contact.company})`);
  }
  
  return parts.join(' ');
}