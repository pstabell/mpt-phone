# Phase 3 Implementation - Click-to-Call & SMS Testing

## URL Parameter Testing

Test the click-to-call functionality by visiting these URLs:

1. **Basic Call**: `http://localhost:3000?call=+12345678901`
2. **With SMS Param**: `http://localhost:3000?call=+12345678901&sms=true`

## PostMessage API Testing

```javascript
// For embedded iframe usage
const phoneFrame = document.getElementById('mpt-phone-iframe');

// Initiate a call
phoneFrame.contentWindow.postMessage({
  type: 'MPT_PHONE_CALL',
  phoneNumber: '+12345678901'
}, '*');

// Initiate SMS
phoneFrame.contentWindow.postMessage({
  type: 'MPT_PHONE_SMS',
  phoneNumber: '+12345678901',
  message: 'Hello from CRM!'
}, '*');

// Listen for ready event
window.addEventListener('message', (event) => {
  if (event.data.type === 'MPT_PHONE_READY') {
    console.log('MPT Phone is ready for postMessage API');
  }
});
```

## URL Protocol Handler Setup

For `mpt-phone://call/+1234567890` protocol support, add this to your system:

### Windows Registry Entry
```reg
Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\mpt-phone]
@="URL:MPT Phone Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\mpt-phone\DefaultIcon]
@="C:\\Program Files\\MPT-Phone\\icon.ico"

[HKEY_CLASSES_ROOT\mpt-phone\shell]

[HKEY_CLASSES_ROOT\mpt-phone\shell\open]

[HKEY_CLASSES_ROOT\mpt-phone\shell\open\command]
@="\"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe\" \"https://mpt-phone.vercel.app?call=%1\""
```

### Browser Handler Script
```javascript
// Add this to your CRM application
function initiateCall(phoneNumber) {
  // Try protocol handler first
  const protocolUrl = `mpt-phone://call/${phoneNumber}`;
  
  try {
    window.location.href = protocolUrl;
  } catch (e) {
    // Fallback to direct URL
    window.open(`https://mpt-phone.vercel.app?call=${phoneNumber}`, '_blank');
  }
}

// Usage in CRM
document.getElementById('call-button').onclick = () => {
  initiateCall('+12345678901');
};
```

## SMS Webhook Configuration

Configure this webhook URL in your Twilio Console for incoming SMS:

**Webhook URL**: `https://mpt-phone.vercel.app/api/sms/webhook`
**HTTP Method**: POST

## Database Schema Updates

Run this SQL in Supabase to add Phase 3 features:

```sql
-- Run the contents of database/add_phase3_features.sql
```

## Testing Checklist

### CRM Integration
- [ ] Call lookup shows contact name, company, notes during call
- [ ] Call history displays contact information
- [ ] Contact information persists in call logs

### Click-to-Call
- [ ] URL parameters work: `?call=+1234567890`
- [ ] PostMessage API works for embedded use
- [ ] Protocol handler registered (Windows)

### SMS Features
- [ ] Send SMS from phone app interface
- [ ] Receive SMS via webhook
- [ ] SMS conversations linked to contacts
- [ ] Unread SMS count displays correctly
- [ ] SMS modal shows conversation history

### Integration Points
- [ ] MPT-CRM contact lookup working
- [ ] Twilio SMS API integration functional
- [ ] Database tables created and populated
- [ ] All API endpoints responding correctly