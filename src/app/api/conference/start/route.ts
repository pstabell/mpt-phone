// Phase 4: Conference Call Start API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = require('twilio')(accountSid, authToken);

// POST /api/conference/start - Start a new conference call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conferenceName, currentCallSid } = body;

    if (!conferenceName || !currentCallSid) {
      return NextResponse.json(
        { error: 'conferenceName and currentCallSid are required' },
        { status: 400 }
      );
    }

    // Create conference in Twilio
    let twilioConference;
    try {
      // Move the current call to a conference
      await twilioClient.calls(currentCallSid)
        .update({
          twiml: `<Response>
            <Dial>
              <Conference 
                beep="true" 
                startConferenceOnEnter="true"
                endConferenceOnExit="false"
                waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
              >
                ${conferenceName}
              </Conference>
            </Dial>
          </Response>`
        });

      // Get conference details from Twilio
      const conferences = await twilioClient.conferences.list({
        friendlyName: conferenceName,
        status: 'in-progress'
      });

      if (conferences.length > 0) {
        twilioConference = conferences[0];
      } else {
        throw new Error('Conference not found after creation');
      }

    } catch (twilioError) {
      console.error('Twilio error creating conference:', twilioError);
      return NextResponse.json(
        { error: 'Failed to create conference call' },
        { status: 500 }
      );
    }

    // Save conference to database
    const { data: conferenceData, error: dbError } = await supabase
      .from('conference_calls')
      .insert({
        conference_name: conferenceName,
        conference_sid: twilioConference.sid,
        initiator_number: '+12394267058', // Our JackBot number
        status: 'active'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error saving conference:', dbError);
      return NextResponse.json(
        { error: 'Failed to save conference data' },
        { status: 500 }
      );
    }

    // Get participants (initially just the current caller)
    const participants = await twilioClient
      .conferences(twilioConference.sid)
      .participants
      .list();

    // Save participants to database
    for (const participant of participants) {
      await supabase
        .from('conference_participants')
        .insert({
          conference_id: conferenceData.id,
          participant_number: participant.callSid, // This would need to be mapped to phone number
          call_sid: participant.callSid,
          status: 'connected'
        });
    }

    return NextResponse.json({
      conferenceId: conferenceData.id,
      conferenceSid: twilioConference.sid,
      conferenceName: conferenceName,
      participants: participants.map((p: { callSid: string }) => ({
        id: p.callSid,
        participant_number: p.callSid,
        status: 'connected'
      }))
    });

  } catch (error) {
    console.error('Error in POST /api/conference/start:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}