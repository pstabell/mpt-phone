import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { lookupContactByPhone } from '@/lib/crm';

const twilio = require('twilio');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Phase 3: Send SMS message
export async function POST(request: NextRequest) {
  try {
    const { to, body } = await request.json();

    if (!to || !body) {
      return NextResponse.json(
        { error: 'Phone number and message body are required' },
        { status: 400 }
      );
    }

    // Format phone number
    let formattedTo = to.replace(/[^0-9+]/g, '');
    if (!formattedTo.startsWith('+')) {
      if (formattedTo.length === 10) {
        formattedTo = '+1' + formattedTo;
      } else if (formattedTo.length === 11 && formattedTo.startsWith('1')) {
        formattedTo = '+' + formattedTo;
      }
    }

    // Send SMS via Twilio
    const message = await twilioClient.messages.create({
      body: body,
      from: TWILIO_PHONE_NUMBER,
      to: formattedTo
    });

    // Lookup contact for linking
    const contact = await lookupContactByPhone(formattedTo);

    // Save to database
    const { data, error } = await supabase
      .from('sms_messages')
      .insert({
        direction: 'outbound',
        from_number: TWILIO_PHONE_NUMBER,
        to_number: formattedTo,
        body: body,
        status: message.status,
        contact_id: contact ? contact.id : null,
        message_sid: message.sid,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving SMS to database:', error);
      // Don't fail the request if database save fails
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        message_sid: message.sid,
        twilio_status: message.status
      }
    });

  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}

// Phase 3: Get SMS messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const phone = searchParams.get('phone'); // Optional: filter by phone number

    let query = supabase
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by phone number if provided
    if (phone) {
      const formattedPhone = phone.replace(/[^0-9+]/g, '');
      query = query.or(`from_number.eq.${formattedPhone},to_number.eq.${formattedPhone}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching SMS messages:', error);
      return NextResponse.json({ error: 'Failed to fetch SMS messages' }, { status: 500 });
    }

    // Enhance SMS messages with contact info
    const enhancedMessages = await Promise.all(data.map(async (message: any) => {
      const phoneToLookup = message.direction === 'outbound' ? message.to_number : message.from_number;
      
      let contactInfo = null;
      if (!message.contact_id) {
        // Try to find contact if not already linked
        const contact = await lookupContactByPhone(phoneToLookup);
        if (contact) {
          contactInfo = {
            name: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
            company: contact.company,
            notes: contact.notes
          };
        }
      } else {
        // Fetch linked contact
        const { data: contactData } = await supabase
          .from('contacts')
          .select('first_name, last_name, company, notes')
          .eq('id', message.contact_id)
          .single();

        if (contactData) {
          contactInfo = {
            name: [contactData.first_name, contactData.last_name].filter(Boolean).join(' '),
            company: contactData.company,
            notes: contactData.notes
          };
        }
      }

      return {
        ...message,
        contact_info: contactInfo
      };
    }));

    return NextResponse.json({ success: true, data: enhancedMessages });

  } catch (error) {
    console.error('Error fetching SMS messages:', error);
    return NextResponse.json({ error: 'Failed to fetch SMS messages' }, { status: 500 });
  }
}