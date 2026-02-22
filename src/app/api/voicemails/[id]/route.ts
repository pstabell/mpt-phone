import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const updates = await request.json();
    const { id: voicemailId } = await params;

    const { data, error } = await supabase
      .from('voicemails')
      .update(updates)
      .eq('id', voicemailId)
      .select()
      .single();

    if (error) {
      console.error('Error updating voicemail:', error);
      return NextResponse.json({ error: 'Failed to update voicemail' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error updating voicemail:', error);
    return NextResponse.json({ error: 'Failed to update voicemail' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voicemailId } = await params;

    const { error } = await supabase
      .from('voicemails')
      .delete()
      .eq('id', voicemailId);

    if (error) {
      console.error('Error deleting voicemail:', error);
      return NextResponse.json({ error: 'Failed to delete voicemail' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting voicemail:', error);
    return NextResponse.json({ error: 'Failed to delete voicemail' }, { status: 500 });
  }
}