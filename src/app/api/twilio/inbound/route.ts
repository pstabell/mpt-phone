import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

// Jack's Vapi number (primary)
const JACK_VAPI_NUMBER = '+12399661917';
// Patrick's cell (fallback)
const PATRICK_CELL = '+12396008159';
// Timeout before fallback (seconds)
const RING_TIMEOUT = 20;

export async function POST(request: NextRequest) {
  try {
    const twiml = new VoiceResponse();

    // Dial Jack first, with fallback to Patrick's cell
    const dial = twiml.dial({
      timeout: RING_TIMEOUT,
      action: '/api/twilio/inbound/fallback', // Called if Jack doesn't answer
      method: 'POST',
    });

    // Try Jack's Vapi number first
    dial.number(JACK_VAPI_NUMBER);

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error handling inbound call:', error);
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error connecting your call. Please try again.');
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET() {
  const twiml = new VoiceResponse();
  twiml.say('MPT Phone inbound endpoint is working.');
  
  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
