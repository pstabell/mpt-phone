import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unread') === 'true';

    let query = supabase
      .from('voicemails')
      .select(`
        *,
        phone_call_logs!inner(
          from_number,
          to_number,
          created_at,
          direction
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching voicemails:', error);
      return NextResponse.json({ error: 'Failed to fetch voicemails' }, { status: 500 });
    }

    // Enhance with contact information
    const enhancedVoicemails = await Promise.all(data.map(async (voicemail: any) => {
      const phoneToLookup = voicemail.from_number;
      const cleanPhone = phoneToLookup.replace(/[^\d]/g, '').replace(/^1/, '');
      
      const { data: contacts } = await supabase
        .from('contacts')
        .select('first_name, last_name, company')
        .or(`phone.ilike.%${cleanPhone}%`)
        .limit(1);

      let contactName = null;
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        if (contact.first_name && contact.last_name) {
          contactName = `${contact.first_name} ${contact.last_name}`;
          if (contact.company) {
            contactName += ` (${contact.company})`;
          }
        } else if (contact.company) {
          contactName = contact.company;
        }
      }

      return {
        ...voicemail,
        contact_name: contactName
      };
    }));

    return NextResponse.json({ success: true, data: enhancedVoicemails });

  } catch (error) {
    console.error('Error fetching voicemails:', error);
    return NextResponse.json({ error: 'Failed to fetch voicemails' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const voicemailData = await request.json();

    const { data, error } = await supabase
      .from('voicemails')
      .insert({
        call_log_id: voicemailData.call_log_id,
        from_number: voicemailData.from_number,
        recording_url: voicemailData.recording_url,
        duration: voicemailData.duration,
        transcription: voicemailData.transcription,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving voicemail:', error);
      return NextResponse.json({ error: 'Failed to save voicemail' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Error saving voicemail:', error);
    return NextResponse.json({ error: 'Failed to save voicemail' }, { status: 500 });
  }
}