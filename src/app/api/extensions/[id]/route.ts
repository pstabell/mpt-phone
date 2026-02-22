import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/extensions/[id] - Get a specific extension
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: extension, error } = await supabase
      .from('extensions')
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name,
          role
        ),
        user_presence(
          status,
          status_message,
          last_activity,
          updated_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Extension not found' }, { status: 404 });
      }
      console.error('Error fetching extension:', error);
      return NextResponse.json({ error: 'Failed to fetch extension' }, { status: 500 });
    }

    return NextResponse.json({ extension });
  } catch (error) {
    console.error('Exception in GET /api/extensions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/extensions/[id] - Update an extension
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      extension_name, 
      user_id, 
      direct_dial_number, 
      voicemail_enabled, 
      call_forwarding_number,
      is_active 
    } = body;

    const updateData: any = {};
    if (extension_name !== undefined) updateData.extension_name = extension_name;
    if (user_id !== undefined) updateData.user_id = user_id;
    if (direct_dial_number !== undefined) updateData.direct_dial_number = direct_dial_number;
    if (voicemail_enabled !== undefined) updateData.voicemail_enabled = voicemail_enabled;
    if (call_forwarding_number !== undefined) updateData.call_forwarding_number = call_forwarding_number;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: extension, error } = await supabase
      .from('extensions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Extension not found' }, { status: 404 });
      }
      console.error('Error updating extension:', error);
      return NextResponse.json({ error: 'Failed to update extension' }, { status: 500 });
    }

    // If user assignment changed, update presence
    if (user_id !== undefined) {
      if (user_id) {
        // Assign new user
        const { error: presenceError } = await supabase
          .from('user_presence')
          .upsert({
            tenant_id: extension.tenant_id,
            user_id: user_id,
            extension_id: extension.id,
            status: 'available'
          });

        if (presenceError) {
          console.error('Error updating presence:', presenceError);
        }
      } else {
        // Unassign user - remove presence
        const { error: presenceError } = await supabase
          .from('user_presence')
          .delete()
          .eq('extension_id', id);

        if (presenceError) {
          console.error('Error removing presence:', presenceError);
        }
      }
    }

    return NextResponse.json({ extension });
  } catch (error) {
    console.error('Exception in PUT /api/extensions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/extensions/[id] - Delete an extension
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Remove presence record first
    await supabase
      .from('user_presence')
      .delete()
      .eq('extension_id', id);

    // Delete the extension
    const { error } = await supabase
      .from('extensions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting extension:', error);
      return NextResponse.json({ error: 'Failed to delete extension' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Extension deleted successfully' });
  } catch (error) {
    console.error('Exception in DELETE /api/extensions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}