import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

export async function POST(request: NextRequest) {
  try {
    let identity = 'mpt-phone-user';
    
    try {
      const body = await request.json();
      if (body?.identity) {
        identity = body.identity;
      }
    } catch (parseError) {
      // Use default identity if no body or invalid JSON
      console.log('Using default identity, parse error:', parseError);
    }

    // Trim env vars to remove any trailing newlines from Vercel env setup
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      const missing = [];
      if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
      if (!apiKeySid) missing.push('TWILIO_API_KEY_SID');
      if (!apiKeySecret) missing.push('TWILIO_API_KEY_SECRET');
      if (!twimlAppSid) missing.push('TWILIO_TWIML_APP_SID');
      console.error('Missing Twilio config:', missing.join(', '));
      return NextResponse.json({ 
        error: 'Missing Twilio configuration',
        missing: missing
      }, { status: 500 });
    }
    
    // Log credential lengths for debugging (not values)
    console.log('Twilio config check:', {
      accountSid: accountSid?.length,
      apiKeySid: apiKeySid?.length,
      apiKeySecret: apiKeySecret?.length,
      twimlAppSid: twimlAppSid?.length
    });

    // Create an access token with API Key credentials
    const token = new AccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      { identity: identity }
    );

    // Create a Voice grant and add it to the token
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false, // We don't need incoming calls for now
    });

    token.addGrant(voiceGrant);

    return NextResponse.json({
      token: token.toJwt(),
      identity: identity
    });

  } catch (error: any) {
    console.error('Error generating token:', error);
    return NextResponse.json({ 
      error: 'Failed to generate token',
      details: error?.message || String(error)
    }, { status: 500 });
  }
}