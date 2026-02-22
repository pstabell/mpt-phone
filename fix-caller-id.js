const { execSync } = require('child_process');

// Set TWILIO_CALLER_ID properly (Jack's Vapi number for caller ID display)
const value = '+12399661917';

console.log('Setting TWILIO_CALLER_ID to:', value);
execSync(`vercel env add TWILIO_CALLER_ID production`, {
  input: value,
  stdio: ['pipe', 'inherit', 'inherit']
});

console.log('Done! Now redeploying...');
execSync('vercel --prod --yes', { stdio: 'inherit' });
