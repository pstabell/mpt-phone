// Phase 4: Call Transfer API (Transfer to Jack)
import { NextRequest, NextResponse } from 'next/server';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = require('twilio')(accountSid, authToken);

// POST /api/calls/transfer - Transfer active call to another number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callSid, transferTo, transferType = 'warm' } = body;

    if (!callSid || !transferTo) {
      return NextResponse.json(
        { error: 'callSid and transferTo are required' },
        { status: 400 }
      );
    }

    // Validate transfer target (Jack's Vapi number)
    if (transferTo !== '+12399661917') {
      return NextResponse.json(
        { error: 'Only transfers to Jack are currently supported' },
        { status: 400 }
      );
    }

    let transferResult;
    try {
      if (transferType === 'warm') {
        // Warm transfer: Create a conference with both parties
        const conferenceName = `transfer-${Date.now()}`;
        
        // First, move current call to conference
        await twilioClient.calls(callSid)
          .update({
            twiml: `<Response>
              <Say>Please hold while we connect you to Jack, our AI assistant.</Say>
              <Dial>
                <Conference 
                  beep="true" 
                  startConferenceOnEnter="true"
                  endConferenceOnExit="true"
                  waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
                >
                  ${conferenceName}
                </Conference>
              </Dial>
            </Response>`
          });

        // Then, call Jack and add to same conference
        const jackCall = await twilioClient.calls.create({
          to: transferTo,
          from: '+12394267058', // JackBot number
          twiml: `<Response>
            <Say>Incoming transfer call.</Say>
            <Dial>
              <Conference 
                beep="true"
                startConferenceOnEnter="false"
                endConferenceOnExit="true"
                waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
              >
                ${conferenceName}
              </Conference>
            </Dial>
          </Response>`
        });

        transferResult = {
          type: 'warm',
          conferenceName,
          jackCallSid: jackCall.sid
        };

      } else {
        // Cold transfer: Direct transfer using Twilio's redirect
        await twilioClient.calls(callSid)
          .update({
            twiml: `<Response>
              <Say>Transferring you to Jack, our AI assistant.</Say>
              <Dial>
                <Number>${transferTo}</Number>
              </Dial>
            </Response>`
          });

        transferResult = {
          type: 'cold',
          transferredTo: transferTo
        };
      }

    } catch (twilioError: unknown) {
      console.error('Twilio error during transfer:', twilioError);
      
      // Check if it's a specific Twilio error
      const error = twilioError as { code?: number; message?: string };
      if (error.code === 21220) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      } else if (error.code === 21217) {
        return NextResponse.json(
          { error: 'Phone number not verified for outbound calls' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'Failed to transfer call: ' + (error.message || 'Unknown error') },
          { status: 500 }
        );
      }
    }

    // Log the transfer (optional)
    console.log(`Call transfer initiated:`, {
      originalCallSid: callSid,
      transferTo,
      transferType,
      result: transferResult
    });

    return NextResponse.json({
      success: true,
      message: `Call successfully transferred to Jack (${transferTo})`,
      transfer: transferResult
    });

  } catch (error) {
    console.error('Error in POST /api/calls/transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}