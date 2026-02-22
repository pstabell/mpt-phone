// Phase 4: Get Conference Data API
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

// GET /api/conference/[id] - Get conference data with participants
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get conference from database
    const { data: conference, error: conferenceError } = await supabase
      .from('conference_calls')
      .select('*')
      .eq('id', id)
      .single();

    if (conferenceError || !conference) {
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      );
    }

    // Get participants from database
    const { data: dbParticipants, error: participantsError } = await supabase
      .from('conference_participants')
      .select('*')
      .eq('conference_id', id)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Get live participant status from Twilio
    let liveParticipants: any[] = [];
    try {
      if (conference.status === 'active') {
        liveParticipants = await twilioClient
          .conferences(conference.conference_sid)
          .participants
          .list();
      }
    } catch (twilioError) {
      console.log('Could not fetch live participants from Twilio:', twilioError);
      // Continue with database data only
    }

    // Merge database participants with live status
    const participants = dbParticipants.map(dbParticipant => {
      const liveParticipant = liveParticipants.find(
        live => live.callSid === dbParticipant.call_sid
      );

      return {
        id: dbParticipant.id,
        participant_number: dbParticipant.participant_number,
        participant_name: dbParticipant.participant_name,
        status: liveParticipant ? 'connected' : dbParticipant.status,
        joined_at: dbParticipant.joined_at,
        left_at: dbParticipant.left_at,
        // Additional live data if available
        muted: liveParticipant?.muted || false,
        hold: liveParticipant?.hold || false
      };
    });

    // Update conference status based on live participants
    let conferenceStatus = conference.status;
    if (conference.status === 'active' && liveParticipants.length === 0) {
      // Conference ended - update in database
      conferenceStatus = 'completed';
      await supabase
        .from('conference_calls')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', id);

      // Update participants who haven't left yet
      await supabase
        .from('conference_participants')
        .update({ 
          status: 'disconnected',
          left_at: new Date().toISOString()
        })
        .eq('conference_id', id)
        .is('left_at', null);
    }

    const conferenceData = {
      id: conference.id,
      conference_name: conference.conference_name,
      conference_sid: conference.conference_sid,
      initiator_number: conference.initiator_number,
      status: conferenceStatus,
      created_at: conference.created_at,
      ended_at: conference.ended_at,
      participants: participants
    };

    return NextResponse.json({ data: conferenceData });

  } catch (error) {
    console.error('Error in GET /api/conference/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}