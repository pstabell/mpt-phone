import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/presence/heartbeat - Keep user presence alive
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, tenant_id } = body;

    if (!user_id || !tenant_id) {
      return NextResponse.json({ 
        error: 'user_id and tenant_id are required' 
      }, { status: 400 });
    }

    // Update last activity timestamp
    const { data: presence, error } = await supabase
      .from('user_presence')
      .update({
        last_activity: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('tenant_id', tenant_id)
      .select('id, status, last_activity')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No presence record exists, create one
        const { data: newPresence, error: createError } = await supabase
          .from('user_presence')
          .insert({
            tenant_id,
            user_id,
            status: 'available',
            last_activity: new Date().toISOString()
          })
          .select('id, status, last_activity')
          .single();

        if (createError) {
          console.error('Error creating presence record:', createError);
          return NextResponse.json({ error: 'Failed to create presence record' }, { status: 500 });
        }

        return NextResponse.json({ 
          message: 'Presence heartbeat recorded',
          presence: newPresence
        });
      }

      console.error('Error updating presence heartbeat:', error);
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Presence heartbeat recorded',
      presence 
    });
  } catch (error) {
    console.error('Exception in POST /api/presence/heartbeat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Presence heartbeat endpoint is working',
    timestamp: new Date().toISOString()
  });
}