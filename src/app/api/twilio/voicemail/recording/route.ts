import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const recordingStatus = formData.get('RecordingStatus') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;
    const from = formData.get('From') as string;

    console.log('Recording status update:', {
      status: recordingStatus,
      url: recordingUrl,
      duration: recordingDuration,
      from
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing recording status:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
