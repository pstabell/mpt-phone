import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tenants/[id] - Get a specific tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        *,
        tenant_users(
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          created_at
        ),
        extensions(
          id,
          extension_number,
          extension_name,
          user_id,
          direct_dial_number,
          voicemail_enabled,
          call_forwarding_number,
          is_active
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      console.error('Error fetching tenant:', error);
      return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Exception in GET /api/tenants/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/tenants/[id] - Update a tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, domain, phone_number, max_extensions, plan_type, is_active, settings } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (domain !== undefined) updateData.domain = domain;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (max_extensions !== undefined) updateData.max_extensions = max_extensions;
    if (plan_type !== undefined) updateData.plan_type = plan_type;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (settings !== undefined) updateData.settings = settings;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tenant with this slug already exists' }, { status: 409 });
      }
      console.error('Error updating tenant:', error);
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Exception in PUT /api/tenants/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tenants/[id] - Delete a tenant (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if tenant exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      console.error('Error fetching tenant for deletion:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 });
    }

    // Soft delete - just mark as inactive instead of hard delete to preserve data
    const { error } = await supabase
      .from('tenants')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating tenant:', error);
      return NextResponse.json({ error: 'Failed to deactivate tenant' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tenant deactivated successfully' });
  } catch (error) {
    console.error('Exception in DELETE /api/tenants/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}