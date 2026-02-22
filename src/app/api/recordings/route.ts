import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const callLogId = searchParams.get('callLogId');

    let query = supabase
      .from('call_recordings')
      .select(`
        *,
        phone_call_logs!inner(
          from_number,
          to_number,
          created_at,
          direction,
          duration
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (callLogId) {
      query = query.eq('call_log_id', callLogId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recordings:', error);
      return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const recordingData = await request.json();

    const { data, error } = await supabase
      .from('call_recordings')
      .insert({
        call_log_id: recordingData.call_log_id,
        recording_url: recordingData.recording_url,
        duration: recordingData.duration,
        consent_given: recordingData.consent_given || false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving recording:', error);
      return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error saving recording:', error);
    return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
  }
}

// Start recording a call
export async function PUT(request: NextRequest) {
  try {
    const { callSid, consentGiven } = await request.json();

    if (!consentGiven) {
      return NextResponse.json({ error: 'Recording consent required' }, { status: 400 });
    }

    // Start recording via Twilio API
    const recording = await twilioClient.calls(callSid).recordings.create({
      recordingStatusCallback: `/api/recordings/status`,
      recordingStatusCallbackMethod: 'POST'
    });

    return NextResponse.json({ 
      success: true, 
      recordingSid: recording.sid,
      message: 'Recording started'
    });

  } catch (error) {
    console.error('Error starting recording:', error);
    return NextResponse.json({ error: 'Failed to start recording' }, { status: 500 });
  }
}