import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/internal-calls/status - Handle Twilio conference status callbacks
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const conferenceSid = formData.get('ConferenceSid') as string;
    const statusCallbackEvent = formData.get('StatusCallbackEvent') as string;
    const timestamp = formData.get('Timestamp') as string;

    if (!conferenceSid || !statusCallbackEvent) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Find the internal call record
    const { data: internalCall, error: findError } = await supabase
      .from('internal_calls')
      .select(`
        *,
        from_extensions:extensions!internal_calls_from_extension_id_fkey(
          id,
          extension_number,
          tenant_users(id)
        ),
        to_extensions:extensions!internal_calls_to_extension_id_fkey(
          id,
          extension_number,
          tenant_users(id)
        )
      `)
      .eq('conference_sid', conferenceSid)
      .single();

    if (findError || !internalCall) {
      console.error('Internal call not found for conference:', conferenceSid);
      return NextResponse.json({ error: 'Internal call not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (statusCallbackEvent) {
      case 'conference-start':
        updateData.status = 'connected';
        break;
        
      case 'conference-end':
        updateData.status = 'completed';
        updateData.ended_at = new Date().toISOString();
        
        // Calculate duration if we have start time
        if (internalCall.created_at) {
          const startTime = new Date(internalCall.created_at);
          const endTime = new Date();
          updateData.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        }
        break;
        
      case 'participant-join':
        // Could track individual participant join events
        if (internalCall.status === 'ringing') {
          updateData.status = 'connected';
        }
        break;
        
      case 'participant-leave':
        // Could track when participants leave
        break;
    }

    // Update the internal call record
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('internal_calls')
        .update(updateData)
        .eq('id', internalCall.id);

      if (updateError) {
        console.error('Error updating internal call:', updateError);
      }
    }

    // Update user presence when call ends
    if (statusCallbackEvent === 'conference-end') {
      // Reset presence for both users to 'available'
      const presenceUpdates = [];

      if (internalCall.from_extensions?.tenant_users?.[0]) {
        presenceUpdates.push(
          supabase
            .from('user_presence')
            .update({
              status: 'available',
              status_message: null
            })
            .eq('user_id', internalCall.from_extensions.tenant_users[0].id)
        );
      }

      if (internalCall.to_extensions?.tenant_users?.[0]) {
        presenceUpdates.push(
          supabase
            .from('user_presence')
            .update({
              status: 'available',
              status_message: null
            })
            .eq('user_id', internalCall.to_extensions.tenant_users[0].id)
        );
      }

      // Execute all presence updates
      await Promise.allSettled(presenceUpdates);
    }

    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('Exception in internal call status callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Internal calls status endpoint is working' });
}