// Phase 4: Favorites/Speed Dial API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/favorites - Get all favorites
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', 'default_user')
      .order('speed_dial_position', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching favorites:', error);
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/favorites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/favorites - Create a new favorite
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contact_name, phone_number, company, speed_dial_position } = body;

    if (!contact_name || !phone_number) {
      return NextResponse.json(
        { error: 'contact_name and phone_number are required' },
        { status: 400 }
      );
    }

    // Validate speed_dial_position if provided
    if (speed_dial_position !== undefined && speed_dial_position !== null) {
      if (speed_dial_position < 1 || speed_dial_position > 9) {
        return NextResponse.json(
          { error: 'speed_dial_position must be between 1 and 9' },
          { status: 400 }
        );
      }

      // Check if position is already taken
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', 'default_user')
        .eq('speed_dial_position', speed_dial_position)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: `Speed dial position ${speed_dial_position} is already taken` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: 'default_user',
        contact_name,
        phone_number,
        company: company || null,
        speed_dial_position: speed_dial_position || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating favorite:', error);
      return NextResponse.json({ error: 'Failed to create favorite' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in POST /api/favorites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}