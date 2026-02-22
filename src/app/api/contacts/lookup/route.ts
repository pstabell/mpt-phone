import { NextRequest, NextResponse } from 'next/server';
import { lookupContactByPhone, getContactDisplayName, getContactSummary } from '@/lib/crm';

// Phase 3: CRM Contact Lookup API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const contact = await lookupContactByPhone(phone);

    if (!contact) {
      return NextResponse.json(
        { contact: null, found: false },
        { status: 200 }
      );
    }

    // Return enriched contact data
    return NextResponse.json({
      contact,
      found: true,
      displayName: getContactDisplayName(contact),
      summary: getContactSummary(contact)
    });

  } catch (error) {
    console.error('Contact lookup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}