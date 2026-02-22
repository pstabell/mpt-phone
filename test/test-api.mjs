#!/usr/bin/env node

/**
 * Simple test script to verify MPT Phone API endpoints
 * Run with: node test/test-api.mjs
 */

const BASE_URL = 'http://localhost:3000';

async function testTokenGeneration() {
  console.log('🔑 Testing Twilio token generation...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/twilio/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'test-user' })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token generated successfully');
      console.log(`   Identity: ${data.identity}`);
      console.log(`   Token length: ${data.token.length} chars`);
    } else {
      const error = await response.text();
      console.log('❌ Token generation failed:', error);
    }
  } catch (error) {
    console.log('❌ Error testing token:', error.message);
  }
}

async function testCallLogging() {
  console.log('📞 Testing call logging...');
  
  try {
    // Create a test call log
    const createResponse = await fetch(`${BASE_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: 'outbound',
        from_number: '+12394267058',
        to_number: '+15555551234',
        status: 'ringing'
      })
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      console.log('✅ Call logged successfully');
      console.log(`   Call ID: ${createData.data.id}`);

      // Test fetching call logs
      const fetchResponse = await fetch(`${BASE_URL}/api/calls?limit=5`);
      if (fetchResponse.ok) {
        const fetchData = await fetchResponse.json();
        console.log(`✅ Retrieved ${fetchData.data.length} call logs`);
      }

      // Test updating call status
      const updateResponse = await fetch(`${BASE_URL}/api/calls/${createData.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          duration: 120
        })
      });

      if (updateResponse.ok) {
        console.log('✅ Call status updated successfully');
      }

    } else {
      const error = await createResponse.text();
      console.log('❌ Call logging failed:', error);
    }
  } catch (error) {
    console.log('❌ Error testing call logging:', error.message);
  }
}

async function runTests() {
  console.log('🧪 MPT Phone API Tests\n');
  
  await testTokenGeneration();
  console.log('');
  await testCallLogging();
  
  console.log('\n✨ Tests completed!');
  console.log('💡 Make sure your dev server is running: npm run dev');
}

runTests();