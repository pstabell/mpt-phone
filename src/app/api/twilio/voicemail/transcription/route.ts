import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const transcriptionText = formData.get('TranscriptionText') as string;
    const transcriptionStatus = formData.get('TranscriptionStatus') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;

    console.log('Voicemail transcription received:', {
      from,
      to,
      status: transcriptionStatus,
      text: transcriptionText,
      recordingUrl,
      duration: recordingDuration,
      callSid
    });

    // Only process completed transcriptions
    if (transcriptionStatus === 'completed' && recordingUrl) {
      await saveVoicemail({
        from,
        to,
        transcription: transcriptionText,
        recordingUrl: recordingUrl + '.mp3',
        duration: parseInt(recordingDuration) || 0,
        callSid
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing transcription:', error);
    return NextResponse.json({ error: 'Failed to process transcription' }, { status: 500 });
  }
}

async function saveVoicemail(data: {
  from: string;
  to: string;
  transcription: string;
  recordingUrl: string;
  duration: number;
  callSid: string;
}) {
  try {
    // First, create/update the call log entry for this voicemail
    const { data: callLog, error: callLogError } = await supabase
      .from('phone_call_logs')
      .insert({
        direction: 'inbound',
        from_number: data.from,
        to_number: data.to,
        status: 'completed',
        duration: 0, // Voicemails have 0 talk time since no one answered
        is_voicemail: true,
        voicemail_url: data.recordingUrl,
        voicemail_duration: data.duration,
        voicemail_transcription: data.transcription,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (callLogError) {
      console.error('Failed to create call log:', callLogError);
      return false;
    }

    // Now save the voicemail in the dedicated voicemails table
    const { error: voicemailError } = await supabase
      .from('voicemails')
      .insert({
        call_log_id: callLog.id,
        from_number: data.from,
        recording_url: data.recordingUrl,
        duration: data.duration,
        transcription: data.transcription,
        is_read: false,
        created_at: new Date().toISOString()
      });

    if (voicemailError) {
      console.error('Failed to save voicemail:', voicemailError);
      return false;
    }

    console.log('Voicemail saved successfully to database');

    // Log for debugging
    console.log('=== VOICEMAIL RECEIVED ===');
    console.log('From:', data.from);
    console.log('Transcription:', data.transcription);
    console.log('Recording:', data.recordingUrl);
    console.log('Duration:', data.duration);
    console.log('==========================');

    return true;
  } catch (e) {
    console.error('Error saving voicemail:', e);
    return false;
  }
}
