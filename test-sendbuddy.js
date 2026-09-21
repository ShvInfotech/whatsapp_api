/**
 * SendBuddy Compatible WhatsApp API Test Script
 *
 * Demonstrates both GET and POST requests matching the user's software:
 * https://aa.sendbuddy.in/api/send?number=" & strMobileNo & "&type=text&message=" & strMessage & "&instance_id=" & strInstance & "&access_token=" & strToken
 */

const http = require('http');
const https = require('https');

// CONFIGURATION:
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const INSTANCE_ID = process.env.INSTANCE_ID || 'TEST_INSTANCE_ID';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'TEST_ACCESS_TOKEN';
const RECIPIENT_NUMBER = process.env.NUMBER || '918140349408';
const MESSAGE_TEXT = 'Hello! This is a test message sent via SendBuddy compatible API.';

async function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log(' SendBuddy Compatible API Tester');
  console.log(' Target URL:', BASE_URL);
  console.log('===========================================================\n');

  // Test 1: Missing Token validation
  console.log('[Test 1] Testing missing token validation...');
  const res1 = await makeRequest(`${BASE_URL}/api/send?number=${RECIPIENT_NUMBER}&message=Test`);
  console.log('HTTP Status:', res1.status);
  console.log('Response:', JSON.stringify(res1.body, null, 2));

  // Test 2: Invalid Token validation
  console.log('\n[Test 2] Testing invalid credentials validation...');
  const res2 = await makeRequest(`${BASE_URL}/api/send?number=${RECIPIENT_NUMBER}&type=text&message=Test&instance_id=INVALID_ID&access_token=INVALID_TOKEN`);
  console.log('HTTP Status:', res2.status);
  console.log('Response:', JSON.stringify(res2.body, null, 2));

  // Test 3: Standard GET URL (Exact user format)
  console.log('\n[Test 3] User format string:');
  const userUrl = `${BASE_URL}/api/send?number=${RECIPIENT_NUMBER}&type=text&message=${encodeURIComponent(MESSAGE_TEXT)}&instance_id=${INSTANCE_ID}&access_token=${ACCESS_TOKEN}`;
  console.log('Constructed URL:');
  console.log(userUrl);

  console.log('\nTo send a live message, run:');
  console.log(`INSTANCE_ID=YOUR_ID ACCESS_TOKEN=YOUR_TOKEN NUMBER=91XXXXXXXXXX node test-sendbuddy.js`);
  console.log('===========================================================');
}

runTests().catch(console.error);
