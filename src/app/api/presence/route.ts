import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/presence - Get presence status for all users in a tenant
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const extensionId = searchParams.get('extension_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    let query = supabase
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
      .eq('tenant_id', tenantId)
      .order('last_activity', { ascending: false });

    if (extensionId) {
      query = query.eq('extension_id', extensionId);
    }

    const { data: presenceList, error } = await query;

    if (error) {
      console.error('Error fetching presence:', error);
      return NextResponse.json({ error: 'Failed to fetch presence' }, { status: 500 });
    }

    // Mark users as offline if they haven't been active recently (5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const enrichedPresence = presenceList?.map(presence => ({
      ...presence,
      status: new Date(presence.last_activity) < fiveMinutesAgo ? 'offline' : presence.status
    })) || [];

    return NextResponse.json({ presence: enrichedPresence });
  } catch (error) {
    console.error('Exception in GET /api/presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/presence - Update user presence
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      user_id, 
      extension_id, 
      status, 
      status_message 
    } = body;

    if (!tenant_id || !user_id || !extension_id) {
      return NextResponse.json({ 
        error: 'tenant_id, user_id, and extension_id are required' 
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['available', 'busy', 'dnd', 'offline'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Verify the user and extension belong to the tenant
    const { data: extension, error: extensionError } = await supabase
      .from('extensions')
      .select(`
        id,
        tenant_id,
        tenant_users(id, tenant_id)
      `)
      .eq('id', extension_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (extensionError || !extension) {
      return NextResponse.json({ 
        error: 'Extension not found or not accessible' 
      }, { status: 404 });
    }

    const { data: user, error: userError } = await supabase
      .from('tenant_users')
      .select('id, tenant_id')
      .eq('id', user_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'User not found or not accessible' 
      }, { status: 404 });
    }

    // Update or insert presence
    const { data: presence, error } = await supabase
      .from('user_presence')
      .upsert({
        tenant_id,
        user_id,
        extension_id,
        status: status || 'available',
        status_message: status_message || null,
        last_activity: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
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
      console.error('Error updating presence:', error);
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
    }

    return NextResponse.json({ presence }, { status: 200 });
  } catch (error) {
    console.error('Exception in POST /api/presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}