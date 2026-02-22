// Twilio Call Status Webhook - Logs call completion
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/xml');
    
    const callSid = req.body?.CallSid;
    const callStatus = req.body?.CallStatus;
    const duration = req.body?.CallDuration;
    const from = req.body?.From;
    const to = req.body?.To;
    
    console.log('Call Status Update:', {
        callSid,
        callStatus,
        duration,
        from,
        to
    });
    
    // TODO: Log to CRM database
    // POST to /api/calls/log with call data
    
    // Return empty TwiML (call is complete)
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);
}
