import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tenant-users/[id] - Get a specific tenant user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: user, error } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error fetching tenant user:', error);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Exception in GET /api/tenant-users/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tenant-users/[id] - Update a tenant user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, first_name, last_name, role, is_active } = body;

    const updateData: any = {};
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (role !== undefined) {
      // Validate role
      const validRoles = ['admin', 'user', 'manager'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ 
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
        }, { status: 400 });
      }
      updateData.role = role;
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: user, error } = await supabase
      .from('tenant_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'A user with this email already exists in this tenant' 
        }, { status: 409 });
      }
      console.error('Error updating tenant user:', error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Exception in PUT /api/tenant-users/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tenant-users/[id] - Delete a tenant user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user exists
    const { data: user, error: fetchError } = await supabase
      .from('tenant_users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error fetching user for deletion:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    // Remove user from any assigned extensions first
    await supabase
      .from('extensions')
      .update({ user_id: null })
      .eq('user_id', id);

    // Remove presence record
    await supabase
      .from('user_presence')
      .delete()
      .eq('user_id', id);

    // Delete the user
    const { error } = await supabase
      .from('tenant_users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tenant user:', error);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Exception in DELETE /api/tenant-users/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}