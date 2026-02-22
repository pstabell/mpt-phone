import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use CRM Supabase for contact search
const supabaseUrl = process.env.SUPABASE_URL_CRM || process.env.NEXT_PUBLIC_SUPABASE_URL_CRM!;
const supabaseKey = process.env.SUPABASE_ANON_KEY_CRM || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_CRM!;

const crmSupabase = createClient(supabaseUrl, supabaseKey);

// Contact search by name API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { contacts: [], message: 'Search query must be at least 2 characters' },
        { status: 200 }
      );
    }

    // Search contacts by name (first_name, last_name, or company)
    const searchTerm = `%${query}%`;
    
    const { data, error } = await crmSupabase
      .from('contacts')
      .select('id, first_name, last_name, company, phone, email')
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},company.ilike.${searchTerm}`)
      .limit(limit)
      .order('last_name', { ascending: true });

    if (error) {
      console.error('Contact search error:', error);
      return NextResponse.json(
        { error: 'Failed to search contacts', details: error.message },
        { status: 500 }
      );
    }

    // Format contacts for display
    const contacts = (data || []).map(contact => ({
      id: contact.id,
      name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.company || 'Unknown',
      company: contact.company,
      phone: contact.phone,
      email: contact.email
    }));

    return NextResponse.json({ contacts, found: contacts.length > 0 });

  } catch (error) {
    console.error('Contact search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
