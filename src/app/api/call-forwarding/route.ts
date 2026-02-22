// Phase 4: Call Forwarding Rules API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/call-forwarding - Get all forwarding rules
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('call_forwarding_rules')
      .select('*')
      .eq('user_id', 'default_user')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching forwarding rules:', error);
      return NextResponse.json({ error: 'Failed to fetch forwarding rules' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/call-forwarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/call-forwarding - Create a new forwarding rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule_name, forward_to_number, condition_type, ring_count, is_active } = body;

    if (!rule_name || !forward_to_number || !condition_type) {
      return NextResponse.json(
        { error: 'rule_name, forward_to_number, and condition_type are required' },
        { status: 400 }
      );
    }

    // Validate condition_type
    const validConditions = ['no_answer', 'busy', 'always', 'after_rings'];
    if (!validConditions.includes(condition_type)) {
      return NextResponse.json(
        { error: 'Invalid condition_type' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('call_forwarding_rules')
      .insert({
        user_id: 'default_user',
        rule_name,
        forward_to_number,
        condition_type,
        ring_count: condition_type === 'after_rings' ? (ring_count || 4) : null,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating forwarding rule:', error);
      return NextResponse.json({ error: 'Failed to create forwarding rule' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in POST /api/call-forwarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}