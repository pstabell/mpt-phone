# MPT Phone - Phase 1 MVP

A web-based softphone application that allows making calls using Twilio with JackBot's caller ID.

## Features

- **Web-based Calling**: Make calls directly from your browser
- **Twilio Integration**: Uses Twilio Voice SDK for reliable calling
- **Caller ID**: All calls show +1 (239) 426-7058 (JackBot's number)
- **Call History**: Stores and displays recent calls in Supabase
- **Real-time UI**: Shows call status, duration, and controls
- **Dialpad**: Interactive dialpad for dialing and DTMF tones

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Voice**: Twilio Voice SDK (@twilio/voice-sdk)
- **Database**: Supabase (MPT-Accounting project)
- **Deployment**: Ready for Vercel

## Setup

### 1. Environment Variables

Copy the environment variables from `.env.local`:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=YOUR_ACCOUNT_SID
TWILIO_AUTH_TOKEN=0325772110ceac3e630392db01dda1c6
TWILIO_PHONE_NUMBER=+12394267058

# Supabase Configuration (MPT-Accounting)
NEXT_PUBLIC_SUPABASE_URL=https://pezgfalkjoucwnfytubb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Database Setup

Run the SQL script in Supabase to create the call logs table:

```sql
-- Run the contents of database/create_phone_call_logs_table.sql
-- in your Supabase SQL Editor
```

### 3. Twilio Configuration

**Important**: You need to create a TwiML Application in Twilio Console:

1. Go to [Twilio Console > Voice > TwiML Apps](https://console.twilio.com/us1/develop/voice/twiml/applications)
2. Create a new TwiML App
3. Set the Voice URL to handle outbound calls (TwiML for dialing)
4. Update the token generation code with the actual Application SID

### 4. Install and Run

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to use the phone.

## Usage

1. **Make a Call**:
   - Enter a phone number or use the dialpad
   - Click "Call" to connect
   - All calls will show JackBot's number (+1 239-426-7058) as caller ID

2. **During a Call**:
   - Use dialpad to send DTMF tones
   - Toggle mute/unmute
   - View call duration
   - Hang up when finished

3. **Call History**:
   - View recent calls in the bottom panel
   - See call status, duration, and timestamp
   - Automatically logged to Supabase

## Next Steps (Future Phases)

- [ ] TwiML App configuration for proper caller ID
- [ ] Incoming call handling
- [ ] Call recording
- [ ] Contact management
- [ ] Advanced call routing
- [ ] Call analytics and reporting

## Troubleshooting

- **"Device not ready"**: Check Twilio credentials and token generation
- **Calls fail to connect**: Verify TwiML App configuration
- **No call history**: Check Supabase connection and table creation

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── twilio/token/    # Twilio access token generation
│   │   └── calls/           # Call logging API routes
│   └── page.tsx             # Main phone interface
├── components/
│   └── PhoneDialer.tsx      # Main dialer component
└── lib/
    └── supabase.ts          # Supabase client configuration
```
