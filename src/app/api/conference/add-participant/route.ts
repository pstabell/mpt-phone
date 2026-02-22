// Phase 4: Add Participant to Conference API
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

// POST /api/conference/add-participant - Add participant to existing conference
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conferenceSid, participantNumber } = body;

    if (!conferenceSid || !participantNumber) {
      return NextResponse.json(
        { error: 'conferenceSid and participantNumber are required' },
        { status: 400 }
      );
    }

    // Format phone number (ensure E.164 format)
    let formattedNumber = participantNumber.replace(/[^0-9+]/g, '');
    if (!formattedNumber.startsWith('+')) {
      if (formattedNumber.length === 10) {
        formattedNumber = '+1' + formattedNumber;
      } else if (formattedNumber.length === 11 && formattedNumber.startsWith('1')) {
        formattedNumber = '+' + formattedNumber;
      }
    }

    // Get conference from database
    const { data: conference, error: conferenceError } = await supabase
      .from('conference_calls')
      .select('*')
      .eq('conference_sid', conferenceSid)
      .eq('status', 'active')
      .single();

    if (conferenceError || !conference) {
      return NextResponse.json(
        { error: 'Conference not found or not active' },
        { status: 404 }
      );
    }

    // Add participant via Twilio
    let twilioParticipant;
    try {
      twilioParticipant = await twilioClient.calls.create({
        to: formattedNumber,
        from: '+12394267058', // JackBot number
        twiml: `<Response>
          <Dial>
            <Conference 
              beep="true"
              startConferenceOnEnter="false"
              endConferenceOnExit="false"
              waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
            >
              ${conference.conference_name}
            </Conference>
          </Dial>
        </Response>`
      });

    } catch (twilioError) {
      console.error('Twilio error adding participant:', twilioError);
      return NextResponse.json(
        { error: 'Failed to add participant to conference' },
        { status: 500 }
      );
    }

    // Save participant to database
    const { data: participantData, error: participantError } = await supabase
      .from('conference_participants')
      .insert({
        conference_id: conference.id,
        participant_number: formattedNumber,
        call_sid: twilioParticipant.sid,
        status: 'connected'
      })
      .select()
      .single();

    if (participantError) {
      console.error('Database error saving participant:', participantError);
      // Note: Call was already made, so we don't fail here
    }

    // Try to get contact information
    let contactName = formattedNumber;
    try {
      const contactResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/contacts/lookup?phone=${encodeURIComponent(formattedNumber)}`
      );
      if (contactResponse.ok) {
        const contactResult = await contactResponse.json();
        if (contactResult.found) {
          contactName = contactResult.displayName;
        }
      }
    } catch (contactError) {
      console.log('Could not lookup contact info:', contactError);
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participantData?.id || twilioParticipant.sid,
        participant_number: formattedNumber,
        participant_name: contactName,
        call_sid: twilioParticipant.sid,
        status: 'connected'
      }
    });

  } catch (error) {
    console.error('Error in POST /api/conference/add-participant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}