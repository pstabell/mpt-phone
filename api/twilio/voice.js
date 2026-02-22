// Twilio Voice Webhook - Handles outbound calls from browser
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/xml');
    
    // Get the destination number from the request
    const to = req.body?.To || req.query?.To;
    const from = req.body?.From || req.query?.From || '+12394267058'; // MPT Phone number
    const callerId = '+12394267058'; // Always use MPT number as caller ID
    
    if (!to) {
        // No destination - return error TwiML
        res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>No destination number provided.</Say>
    <Hangup/>
</Response>`);
        return;
    }
    
    // Generate TwiML to dial the number
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial callerId="${callerId}" timeout="30" action="/api/twilio/call-status">
        <Number>${to}</Number>
    </Dial>
</Response>`;
    
    res.status(200).send(twiml);
}
