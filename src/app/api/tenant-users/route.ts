import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tenant-users - List tenant users (filtered by tenant)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const { data: users, error } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenant users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Exception in GET /api/tenant-users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tenant-users - Create a new tenant user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      email, 
      first_name, 
      last_name, 
      role = 'user'
    } = body;

    if (!tenant_id || !email) {
      return NextResponse.json({ 
        error: 'tenant_id and email are required' 
      }, { status: 400 });
    }

    // Validate role
    const validRoles = ['admin', 'user', 'manager'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id,
        email: email.toLowerCase(),
        first_name,
        last_name,
        role,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant user:', error);
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'A user with this email already exists in this tenant' 
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Exception in POST /api/tenant-users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}