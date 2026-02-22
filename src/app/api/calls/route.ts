import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { lookupContactByPhone, getContactDisplayName, getContactSummary } from '@/lib/crm';

export async function POST(request: NextRequest) {
  try {
    const callData = await request.json();

    // Phase 3: Lookup contact information when logging call
    const phoneToLookup = callData.direction === 'outbound' ? callData.to_number : callData.from_number;
    const contact = await lookupContactByPhone(phoneToLookup);
    const contactName = contact ? getContactDisplayName(contact) : null;

    const { data, error } = await supabase
      .from('phone_call_logs')
      .insert({
        direction: callData.direction,
        from_number: callData.from_number,
        to_number: callData.to_number,
        status: callData.status,
        contact_name: contactName, // Add contact name to the call log
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting call log:', error);
      return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
    }

    // Include contact info in response for immediate UI updates
    const responseData = {
      ...data,
      contact_info: contact ? {
        name: contactName,
        company: contact.company,
        notes: contact.notes
      } : null
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error logging call:', error);
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { data, error } = await supabase
      .from('phone_call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching call logs:', error);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    // Phase 3: Enhanced contact lookup using CRM utilities
    const enhancedLogs = await Promise.all(data.map(async (log: any) => {
      // For outbound calls, lookup the 'to' number in contacts
      // For inbound calls, lookup the 'from' number in contacts
      const phoneToLookup = log.direction === 'outbound' ? log.to_number : log.from_number;
      
      const contact = await lookupContactByPhone(phoneToLookup);
      let contactName = log.contact_name; // Use stored contact name if available
      
      if (contact && !contactName) {
        // If we found a contact but don't have a stored name, use the current contact info
        contactName = getContactDisplayName(contact);
      }

      return {
        ...log,
        contact_name: contactName,
        contact_info: contact ? {
          name: getContactDisplayName(contact),
          company: contact.company,
          notes: contact.notes
        } : null
      };
    }));

    return NextResponse.json({ success: true, data: enhancedLogs });

  } catch (error) {
    console.error('Error fetching call logs:', error);
    return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
  }
}