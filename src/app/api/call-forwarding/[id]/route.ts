// Phase 4: Individual Call Forwarding Rule API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH /api/call-forwarding/[id] - Update a forwarding rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Only allow updating certain fields
    const allowedFields = ['rule_name', 'forward_to_number', 'condition_type', 'ring_count', 'is_active'];
    const updateData: any = {};
    
    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = body[key];
      }
    });
    
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('call_forwarding_rules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', 'default_user')
      .select()
      .single();

    if (error) {
      console.error('Error updating forwarding rule:', error);
      return NextResponse.json({ error: 'Failed to update forwarding rule' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Forwarding rule not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PATCH /api/call-forwarding/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/call-forwarding/[id] - Delete a forwarding rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('call_forwarding_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', 'default_user')
      .select()
      .single();

    if (error) {
      console.error('Error deleting forwarding rule:', error);
      return NextResponse.json({ error: 'Failed to delete forwarding rule' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Forwarding rule not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in DELETE /api/call-forwarding/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}