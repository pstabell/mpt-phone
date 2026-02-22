import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get('To') as string;
    const callerId = process.env.TWILIO_CALLER_ID || process.env.TWILIO_PHONE_NUMBER;

    const twiml = new VoiceResponse();

    if (to) {
      // Outbound call - dial the number
      const dial = twiml.dial({
        callerId: callerId,
        answerOnBridge: true,
      });
      
      // Check if it's a phone number or a client
      if (to.startsWith('client:')) {
        dial.client(to.replace('client:', ''));
      } else {
        // Format as E.164 - handle various input formats
        let digits = to.replace(/\D/g, ''); // Strip all non-digits
        
        // Handle different formats:
        // - 2396008159 (10 digits, no country code) -> +12396008159
        // - 12396008159 (11 digits, has country code) -> +12396008159
        // - +12396008159 (already E.164) -> +12396008159
        if (digits.length === 10) {
          // US number without country code
          digits = '1' + digits;
        } else if (digits.length === 11 && digits.startsWith('1')) {
          // US number with country code, keep as is
        } else if (digits.length > 11) {
          // International number, keep as is
        }
        
        const phoneNumber = '+' + digits;
        console.log('Dialing:', phoneNumber, 'from input:', to);
        dial.number(phoneNumber);
      }
    } else {
      twiml.say('Thanks for calling MPT Phone. Goodbye.');
    }

    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('Error handling voice request:', error);
    const twiml = new VoiceResponse();
    twiml.say('An error occurred. Please try again.');
    
    return new NextResponse(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Also handle GET for testing
export async function GET() {
  const twiml = new VoiceResponse();
  twiml.say('MPT Phone voice endpoint is working.');
  
  return new NextResponse(twiml.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
