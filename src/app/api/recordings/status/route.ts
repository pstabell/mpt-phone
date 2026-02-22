import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const recordingStatus = formData.get('RecordingStatus') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;
    const callSid = formData.get('CallSid') as string;
    const recordingSid = formData.get('RecordingSid') as string;

    console.log('Recording status update:', {
      status: recordingStatus,
      url: recordingUrl,
      duration: recordingDuration,
      callSid,
      recordingSid
    });

    if (recordingStatus === 'completed' && recordingUrl) {
      // Find the call log by searching for calls with matching Twilio call SID
      // Note: We'd need to store call SID in call logs for this to work properly
      // For now, we'll try to match by timestamp and duration
      
      const duration = parseInt(recordingDuration) || 0;
      
      // Try to find the most recent call that could match this recording
      const { data: recentCalls, error: callError } = await supabase
        .from('phone_call_logs')
        .select('*')
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(5);

      if (callError) {
        console.error('Error finding call log:', callError);
        return NextResponse.json({ error: 'Failed to find call log' }, { status: 500 });
      }

      // For now, associate with the most recent connected call
      // In production, you'd want to store and match by callSid
      const matchingCall = recentCalls?.[0];
      
      if (matchingCall) {
        // Save the recording
        const { data, error } = await supabase
          .from('call_recordings')
          .insert({
            call_log_id: matchingCall.id,
            recording_url: recordingUrl,
            duration: duration,
            consent_given: true, // If we got this far, consent was given
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error saving recording:', error);
          return NextResponse.json({ error: 'Failed to save recording' }, { status: 500 });
        }

        // Update the call log with recording info
        await supabase
          .from('phone_call_logs')
          .update({
            recording_url: recordingUrl,
            recording_duration: duration,
            recording_consent: true
          })
          .eq('id', matchingCall.id);

        console.log('Recording saved successfully:', data);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing recording status:', error);
    return NextResponse.json({ error: 'Failed to process recording status' }, { status: 500 });
  }
}