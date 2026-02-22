import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const dialCallStatus = formData.get('DialCallStatus') as string;

    const twiml = new VoiceResponse();

    // If Jack didn't answer (busy, no-answer, failed), go to voicemail
    if (dialCallStatus !== 'completed') {
      console.log('Jack unavailable, going to voicemail. Status:', dialCallStatus);
      
      twiml.say('Hi, you\'ve reached Metro Point Technology. We\'re unable to take your call right now. Please leave a message after the beep and we\'ll get back to you as soon as possible.');
      
      // Record voicemail with transcription
      twiml.record({
        maxLength: 120, // 2 minutes max
        transcribe: true,
        transcribeCallback: '/api/twilio/voicemail/transcription',
        recordingStatusCallback: '/api/twilio/voicemail/recording',
        recordingStatusCallbackMethod: 'POST',
        playBeep: true,
        timeout: 10, // Silence timeout
        action: '/api/twilio/voicemail/complete',
        method: 'POST',
      });
      
      // If they hang up before recording
      twiml.say('We didn\'t receive your message. Goodbye.');
    }

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in fallback:', error);
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error. Please try again later.');
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
