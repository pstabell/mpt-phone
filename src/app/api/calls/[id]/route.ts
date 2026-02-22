import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();

    // Validate disposition if provided
    const validDispositions = [
      'completed', 'follow_up_needed', 'wrong_number', 'no_answer', 
      'busy', 'interested', 'not_interested', 'callback_requested'
    ];
    
    if (updateData.disposition && !validDispositions.includes(updateData.disposition)) {
      return NextResponse.json({ error: 'Invalid disposition value' }, { status: 400 });
    }

    // Build update object with only provided fields
    const updateFields: any = {};
    if (updateData.status !== undefined) updateFields.status = updateData.status;
    if (updateData.duration !== undefined) updateFields.duration = updateData.duration;
    if (updateData.call_notes !== undefined) updateFields.call_notes = updateData.call_notes;
    if (updateData.disposition !== undefined) updateFields.disposition = updateData.disposition;
    if (updateData.recording_url !== undefined) updateFields.recording_url = updateData.recording_url;
    if (updateData.recording_duration !== undefined) updateFields.recording_duration = updateData.recording_duration;
    if (updateData.recording_consent !== undefined) updateFields.recording_consent = updateData.recording_consent;

    const { data, error } = await supabase
      .from('phone_call_logs')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating call log:', error);
      return NextResponse.json({ error: 'Failed to update call log' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error updating call log:', error);
    return NextResponse.json({ error: 'Failed to update call log' }, { status: 500 });
  }
}