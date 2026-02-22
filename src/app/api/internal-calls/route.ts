import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// POST /api/internal-calls - Start an extension-to-extension call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from_extension_id, to_extension_id, tenant_id } = body;

    if (!from_extension_id || !to_extension_id || !tenant_id) {
      return NextResponse.json({ 
        error: 'from_extension_id, to_extension_id, and tenant_id are required' 
      }, { status: 400 });
    }

    // Validate both extensions belong to the same tenant
    const { data: extensions, error: extensionsError } = await supabase
      .from('extensions')
      .select(`
        *,
        tenant_users(
          id,
          first_name,
          last_name,
          email
        ),
        user_presence(
          status
        )
      `)
      .in('id', [from_extension_id, to_extension_id])
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (extensionsError || !extensions || extensions.length !== 2) {
      return NextResponse.json({ 
        error: 'Invalid extensions or extensions not found' 
      }, { status: 404 });
    }

    const fromExtension = extensions.find(ext => ext.id === from_extension_id);
    const toExtension = extensions.find(ext => ext.id === to_extension_id);

    if (!fromExtension || !toExtension) {
      return NextResponse.json({ 
        error: 'One or both extensions not found' 
      }, { status: 404 });
    }

    // Check if target extension is available
    const toPresence = toExtension.user_presence?.[0];
    if (toPresence && (toPresence.status === 'dnd' || toPresence.status === 'offline')) {
      return NextResponse.json({ 
        error: `Extension ${toExtension.extension_number} is not available`,
        target_status: toPresence.status
      }, { status: 409 });
    }

    // Create a unique conference name
    const conferenceName = `internal-${tenant_id}-${Date.now()}`;

    try {
      // Create internal call record first (conference SID will be populated when calls connect)
      // Note: Twilio conferences are created implicitly when participants join
      const { data: internalCall, error: callError } = await supabase
        .from('internal_calls')
        .insert({
          tenant_id,
          from_extension_id,
          to_extension_id,
          conference_sid: conferenceName, // Use conference name as identifier until SID is available
          status: 'ringing'
        })
        .select()
        .single();

      if (callError) {
        console.error('Error creating internal call record:', callError);
        return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 });
      }

      // For now, since we don't have individual user devices connected,
      // we'll use webhook notifications to simulate the calling experience
      // In a full implementation, you would:
      // 1. Send WebRTC or SIP calls to user devices
      // 2. Add participants to the Twilio conference
      // 3. Handle call forwarding if users are not at their desk phones

      // Update presence status to 'busy' for both users during the call
      if (fromExtension.tenant_users?.[0]) {
        await supabase
          .from('user_presence')
          .upsert({
            tenant_id,
            user_id: fromExtension.tenant_users[0].id,
            extension_id: from_extension_id,
            status: 'busy',
            status_message: `On call with ext ${toExtension.extension_number}`
          });
      }

      if (toExtension.tenant_users?.[0]) {
        await supabase
          .from('user_presence')
          .upsert({
            tenant_id,
            user_id: toExtension.tenant_users[0].id,
            extension_id: to_extension_id,
            status: 'busy',
            status_message: `Call from ext ${fromExtension.extension_number}`
          });
      }

      return NextResponse.json({ 
        internal_call: internalCall,
        conference_sid: conferenceName, // Conference SID populated when participants join
        conference_name: conferenceName,
        from_extension: fromExtension.extension_number,
        to_extension: toExtension.extension_number,
        message: 'Internal call initiated'
      }, { status: 201 });

    } catch (error) {
      console.error('Error creating internal call:', error);
      return NextResponse.json({ 
        error: 'Failed to create internal call' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Exception in POST /api/internal-calls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/internal-calls - List internal calls for a tenant
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('internal_calls')
      .select(`
        *,
        from_extensions:extensions!internal_calls_from_extension_id_fkey(
          extension_number,
          extension_name,
          tenant_users(first_name, last_name)
        ),
        to_extensions:extensions!internal_calls_to_extension_id_fkey(
          extension_number,
          extension_name,
          tenant_users(first_name, last_name)
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: internalCalls, error } = await query;

    if (error) {
      console.error('Error fetching internal calls:', error);
      return NextResponse.json({ error: 'Failed to fetch internal calls' }, { status: 500 });
    }

    return NextResponse.json({ internal_calls: internalCalls });
  } catch (error) {
    console.error('Exception in GET /api/internal-calls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}