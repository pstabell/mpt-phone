import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/tenants - List all tenants (admin only)
export async function GET(request: NextRequest) {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        *,
        tenant_users(count),
        extensions(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Exception in GET /api/tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, domain, phone_number, max_extensions = 100, plan_type = 'enterprise' } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Create the tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        domain,
        phone_number,
        max_extensions,
        plan_type,
        is_active: true,
        settings: {}
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      if (tenantError.code === '23505') {
        return NextResponse.json({ error: 'Tenant with this slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
    }

    // Create default extensions (100-109)
    const defaultExtensions = [];
    for (let i = 100; i <= 109; i++) {
      defaultExtensions.push({
        tenant_id: tenant.id,
        extension_number: i.toString(),
        extension_name: `Extension ${i}`,
        is_active: true
      });
    }

    const { error: extensionsError } = await supabase
      .from('extensions')
      .insert(defaultExtensions);

    if (extensionsError) {
      console.error('Error creating default extensions:', extensionsError);
      // Don't fail the tenant creation if extensions fail
    }

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    console.error('Exception in POST /api/tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}