import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// GET /api/internal-calls/[id] - Get a specific internal call
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: internalCall, error } = await supabase
      .from('internal_calls')
      .select(`
        *,
        from_extensions:extensions!internal_calls_from_extension_id_fkey(
          extension_number,
          extension_name,
          tenant_users(id, first_name, last_name, email)
        ),
        to_extensions:extensions!internal_calls_to_extension_id_fkey(
          extension_number,
          extension_name,
          tenant_users(id, first_name, last_name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Internal call not found' }, { status: 404 });
      }
      console.error('Error fetching internal call:', error);
      return NextResponse.json({ error: 'Failed to fetch internal call' }, { status: 500 });
    }

    return NextResponse.json({ internal_call: internalCall });
  } catch (error) {
    console.error('Exception in GET /api/internal-calls/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/internal-calls/[id] - End an internal call
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the internal call record
    const { data: internalCall, error: fetchError } = await supabase
      .from('internal_calls')
      .select(`
        *,
        from_extensions:extensions!internal_calls_from_extension_id_fkey(
          tenant_users(id)
        ),
        to_extensions:extensions!internal_calls_to_extension_id_fkey(
          tenant_users(id)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Internal call not found' }, { status: 404 });
      }
      console.error('Error fetching internal call:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch internal call' }, { status: 500 });
    }

    // If call is already completed, return success
    if (internalCall.status === 'completed') {
      return NextResponse.json({ message: 'Call already completed' });
    }

    try {
      // End the Twilio conference
      if (internalCall.conference_sid) {
        await twilioClient.conferences(internalCall.conference_sid).update({
          status: 'completed'
        });
      }
    } catch (twilioError) {
      console.error('Error ending Twilio conference:', twilioError);
      // Continue with database update even if Twilio call fails
    }

    // Update the internal call record
    const endTime = new Date();
    const duration = internalCall.created_at ? 
      Math.floor((endTime.getTime() - new Date(internalCall.created_at).getTime()) / 1000) : 0;

    const { error: updateError } = await supabase
      .from('internal_calls')
      .update({
        status: 'completed',
        ended_at: endTime.toISOString(),
        duration
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating internal call:', updateError);
      return NextResponse.json({ error: 'Failed to update call record' }, { status: 500 });
    }

    // Reset user presence for both participants
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

    return NextResponse.json({ 
      message: 'Internal call ended successfully',
      duration_seconds: duration
    });

  } catch (error) {
    console.error('Exception in DELETE /api/internal-calls/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}