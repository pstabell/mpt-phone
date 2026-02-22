// Phase 4: Individual Favorite API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DELETE /api/favorites/[id] - Delete a favorite
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', 'default_user')
      .select()
      .single();

    if (error) {
      console.error('Error deleting favorite:', error);
      return NextResponse.json({ error: 'Failed to delete favorite' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in DELETE /api/favorites/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/favorites/[id] - Update a favorite
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Only allow updating certain fields
    const allowedFields = ['contact_name', 'phone_number', 'company', 'speed_dial_position'];
    const updateData: any = {};
    
    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = body[key];
      }
    });
    
    updateData.updated_at = new Date().toISOString();

    // Validate speed_dial_position if provided
    if (updateData.speed_dial_position !== undefined && updateData.speed_dial_position !== null) {
      if (updateData.speed_dial_position < 1 || updateData.speed_dial_position > 9) {
        return NextResponse.json(
          { error: 'speed_dial_position must be between 1 and 9' },
          { status: 400 }
        );
      }

      // Check if position is already taken by another favorite
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', 'default_user')
        .eq('speed_dial_position', updateData.speed_dial_position)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: `Speed dial position ${updateData.speed_dial_position} is already taken` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('favorites')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', 'default_user')
      .select()
      .single();

    if (error) {
      console.error('Error updating favorite:', error);
      return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PATCH /api/favorites/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}