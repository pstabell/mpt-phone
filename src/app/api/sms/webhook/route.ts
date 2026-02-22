import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { lookupContactByPhone } from '@/lib/crm';

// Phase 3: Twilio SMS Webhook
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const messageSid = formData.get('MessageSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const status = formData.get('SmsStatus') as string;

    console.log('Received SMS webhook:', { messageSid, from, to, body, status });

    // Lookup contact for linking
    const contact = await lookupContactByPhone(from);

    // Save to database
    const { data, error } = await supabase
      .from('sms_messages')
      .insert({
        direction: 'inbound',
        from_number: from,
        to_number: to,
        body: body || '',
        status: status || 'received',
        contact_id: contact ? contact.id : null,
        message_sid: messageSid,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving inbound SMS:', error);
      return NextResponse.json({ error: 'Failed to save SMS' }, { status: 500 });
    }

    console.log('Saved inbound SMS:', data);

    // Return empty TwiML response (no auto-reply)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );

  } catch (error) {
    console.error('SMS webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}