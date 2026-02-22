import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/presence/[userId] - Get presence for a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const { data: presence, error } = await supabase
      .from('user_presence')
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name,
          role
        ),
        extensions(
          id,
          extension_number,
          extension_name
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User presence not found' }, { status: 404 });
      }
      console.error('Error fetching user presence:', error);
      return NextResponse.json({ error: 'Failed to fetch user presence' }, { status: 500 });
    }

    // Check if user should be marked as offline (no activity in 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOffline = new Date(presence.last_activity) < fiveMinutesAgo;

    return NextResponse.json({ 
      presence: {
        ...presence,
        status: isOffline ? 'offline' : presence.status
      }
    });
  } catch (error) {
    console.error('Exception in GET /api/presence/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/presence/[userId] - Update presence for a specific user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { status, status_message } = body;

    // Validate status
    const validStatuses = ['available', 'busy', 'dnd', 'offline'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Update presence
    const updateData: any = {
      last_activity: new Date().toISOString()
    };

    if (status !== undefined) updateData.status = status;
    if (status_message !== undefined) updateData.status_message = status_message;

    const { data: presence, error } = await supabase
      .from('user_presence')
      .update(updateData)
      .eq('user_id', userId)
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name
        ),
        extensions(
          id,
          extension_number,
          extension_name
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User presence not found' }, { status: 404 });
      }
      console.error('Error updating user presence:', error);
      return NextResponse.json({ error: 'Failed to update user presence' }, { status: 500 });
    }

    return NextResponse.json({ presence });
  } catch (error) {
    console.error('Exception in PUT /api/presence/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/presence/[userId] - Set user as offline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const { data: presence, error } = await supabase
      .from('user_presence')
      .update({
        status: 'offline',
        status_message: null,
        last_activity: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name
        ),
        extensions(
          id,
          extension_number,
          extension_name
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User presence not found' }, { status: 404 });
      }
      console.error('Error setting user offline:', error);
      return NextResponse.json({ error: 'Failed to set user offline' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'User set to offline',
      presence 
    });
  } catch (error) {
    console.error('Exception in DELETE /api/presence/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}