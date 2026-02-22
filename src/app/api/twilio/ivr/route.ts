import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '@/lib/supabase';

const VoiceResponse = twilio.twiml.VoiceResponse;

// Jack's Vapi number (fallback/operator)
const JACK_VAPI_NUMBER = '+12399661917';
// Timeout for extension dialing
const EXTENSION_TIMEOUT = 25;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const digits = formData.get('Digits') as string;
    
    const twiml = new VoiceResponse();

    // If digits are provided, it's a response to our gather
    if (digits) {
      return await handleExtensionDigits(digits, from, to, twiml);
    }

    // Initial IVR prompt
    const gather = twiml.gather({
      numDigits: 3,
      timeout: 10,
      action: '/api/twilio/ivr',
      method: 'POST',
    });

    gather.say({ voice: 'alice' }, 
      'Welcome to Metro Point Technology. ' +
      'Please enter the three digit extension number you wish to reach, ' +
      'or press 0 to speak with an operator.'
    );

    // If no input, offer options
    twiml.say({ voice: 'alice' }, 'I didn\'t receive any input.');
    
    const finalGather = twiml.gather({
      numDigits: 3,
      timeout: 5,
      action: '/api/twilio/ivr',
      method: 'POST',
    });
    
    finalGather.say({ voice: 'alice' },
      'Please enter an extension number or press 0 for the operator.'
    );
    
    // Final fallback to operator
    twiml.say({ voice: 'alice' }, 'Connecting you to an operator.');
    twiml.dial(JACK_VAPI_NUMBER);

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in IVR handler:', error);
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'Sorry, there was an error. Connecting you to an operator.');
    twiml.dial(JACK_VAPI_NUMBER);
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

async function handleExtensionDigits(digits: string, from: string, to: string, twiml: any) {
  // Handle operator (0)
  if (digits === '0' || digits === '00' || digits === '000') {
    twiml.say({ voice: 'alice' }, 'Connecting you to an operator.');
    twiml.dial(JACK_VAPI_NUMBER);
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  try {
    // Look up the extension - for now, check all tenants (in production, you'd identify tenant by phone number)
    const { data: extension, error } = await supabase
      .from('extensions')
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name
        ),
        user_presence(
          status
        )
      `)
      .eq('extension_number', digits)
      .eq('is_active', true)
      .single();

    if (error || !extension) {
      // Extension not found
      twiml.say({ voice: 'alice' }, `Extension ${digits} is not available.`);
      
      const gather = twiml.gather({
        numDigits: 3,
        timeout: 10,
        action: '/api/twilio/ivr',
        method: 'POST',
      });
      
      gather.say({ voice: 'alice' }, 'Please try another extension or press 0 for the operator.');
      
      // Fallback to operator
      twiml.say({ voice: 'alice' }, 'Connecting you to an operator.');
      twiml.dial(JACK_VAPI_NUMBER);
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Check if user is available
    const presence = extension.user_presence?.[0];
    const isAvailable = !presence || presence.status === 'available';

    // Log the call attempt
    await supabase
      .from('phone_call_logs')
      .insert({
        direction: 'inbound',
        from_number: from,
        to_number: to,
        status: 'ringing',
        tenant_id: extension.tenant_id,
        extension_id: extension.id
      });

    // If user has call forwarding set up, use that
    if (extension.call_forwarding_number) {
      twiml.say({ voice: 'alice' }, `Connecting you to ${extension.extension_name}.`);
      
      const dial = twiml.dial({
        timeout: EXTENSION_TIMEOUT,
        action: '/api/twilio/ivr/voicemail',
        method: 'POST',
      });
      
      dial.number(extension.call_forwarding_number);
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // For now, since we don't have individual user phone connections,
    // route to Jack with extension context
    if (!isAvailable) {
      twiml.say({ voice: 'alice' }, `${extension.extension_name} is currently unavailable.`);
      
      if (extension.voicemail_enabled) {
        twiml.say({ voice: 'alice' }, 'Please leave a message after the beep.');
        twiml.record({
          action: '/api/twilio/voicemail/recording',
          method: 'POST',
          maxLength: 120,
          transcribe: true,
        });
      } else {
        twiml.say({ voice: 'alice' }, 'Connecting you to an operator.');
        twiml.dial(JACK_VAPI_NUMBER);
      }
    } else {
      // Available - connect to Jack with extension context
      twiml.say({ voice: 'alice' }, `Connecting you to ${extension.extension_name}.`);
      
      // Use conference bridge for future internal calling support
      const conferenceName = `ext-${extension.extension_number}-${Date.now()}`;
      
      // Create internal call record
      await supabase
        .from('internal_calls')
        .insert({
          tenant_id: extension.tenant_id,
          to_extension_id: extension.id,
          conference_sid: conferenceName,
          status: 'ringing'
        });
      
      const dial = twiml.dial({
        timeout: EXTENSION_TIMEOUT,
        action: '/api/twilio/ivr/voicemail',
        method: 'POST',
      });
      
      // For now, route to Jack (in production, this would route to the actual user's device)
      dial.number(JACK_VAPI_NUMBER);
    }

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error looking up extension:', error);
    twiml.say({ voice: 'alice' }, `Sorry, there was an error connecting to extension ${digits}.`);
    twiml.say({ voice: 'alice' }, 'Connecting you to an operator.');
    twiml.dial(JACK_VAPI_NUMBER);
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET() {
  const twiml = new VoiceResponse();
  twiml.say({ voice: 'alice' }, 'MPT Phone IVR endpoint is working.');
  
  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}