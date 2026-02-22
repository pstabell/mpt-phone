import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/extensions - List extensions (filtered by tenant)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const { data: extensions, error } = await supabase
      .from('extensions')
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name
        ),
        user_presence(
          status,
          status_message,
          last_activity
        )
      `)
      .eq('tenant_id', tenantId)
      .order('extension_number');

    if (error) {
      console.error('Error fetching extensions:', error);
      return NextResponse.json({ error: 'Failed to fetch extensions' }, { status: 500 });
    }

    return NextResponse.json({ extensions });
  } catch (error) {
    console.error('Exception in GET /api/extensions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/extensions - Create a new extension
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      extension_number, 
      extension_name, 
      user_id, 
      direct_dial_number,
      voicemail_enabled = true,
      call_forwarding_number 
    } = body;

    if (!tenant_id || !extension_number) {
      return NextResponse.json({ 
        error: 'tenant_id and extension_number are required' 
      }, { status: 400 });
    }

    // Validate extension number format (3-4 digits)
    if (!/^\d{3,4}$/.test(extension_number)) {
      return NextResponse.json({ 
        error: 'Extension number must be 3-4 digits' 
      }, { status: 400 });
    }

    const { data: extension, error } = await supabase
      .from('extensions')
      .insert({
        tenant_id,
        extension_number,
        extension_name: extension_name || `Extension ${extension_number}`,
        user_id,
        direct_dial_number,
        voicemail_enabled,
        call_forwarding_number,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating extension:', error);
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'Extension number already exists for this tenant' 
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create extension' }, { status: 500 });
    }

    // If assigning to a user, create presence record
    if (user_id) {
      const { error: presenceError } = await supabase
        .from('user_presence')
        .insert({
          tenant_id,
          user_id,
          extension_id: extension.id,
          status: 'available'
        });

      if (presenceError && presenceError.code !== '23505') {
        console.error('Error creating presence record:', presenceError);
        // Don't fail extension creation if presence fails
      }
    }

    return NextResponse.json({ extension }, { status: 201 });
  } catch (error) {
    console.error('Exception in POST /api/extensions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}