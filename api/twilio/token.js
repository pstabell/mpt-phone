// Twilio Access Token Generator
import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY || process.env.TWILIO_API_KEY_SID;
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET || process.env.TWILIO_API_KEY_SECRET;
const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Check if we have API credentials for token generation
        if (!TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
            // Return demo mode response if not configured
            return res.status(200).json({
                token: null,
                identity: 'demo-user',
                mode: 'demo',
                message: 'Twilio API credentials not configured. Set TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID environment variables.'
            });
        }
        
        const { AccessToken } = twilio.jwt;
        const { VoiceGrant } = AccessToken;
        
        // Generate unique identity for this user/session
        const identity = req.body?.identity || req.query?.identity || `mpt-user-${Date.now()}`;
        
        // Create access token
        const accessToken = new AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY,
            TWILIO_API_SECRET,
            { identity: identity }
        );
        
        // Create Voice grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: TWILIO_TWIML_APP_SID,
            incomingAllow: true
        });
        
        accessToken.addGrant(voiceGrant);
        
        res.status(200).json({
            token: accessToken.toJwt(),
            identity: identity,
            mode: 'live',
            expiresIn: 3600
        });
        
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({
            error: 'Failed to generate token',
            message: error.message
        });
    }
}
