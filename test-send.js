/**
 * Test script to send a WhatsApp message to your second number
 * Run: node test-send.js
 */

const http = require('http');

const targetNumber = '918140349408'; // Your second number with country code 91
const testMessage = 'Hello! Aa message Safe Vault WhatsApp Automation API mathi aavyo che.';

const payload = JSON.stringify({
  phoneNumber: targetNumber,
  message: testMessage
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-message',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log(`Sending test message to ${targetNumber}...`);

const req = http.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('HTTP Status Code:', res.statusCode);
    try {
      const parsed = JSON.parse(responseBody);
      console.log('Response:', JSON.stringify(parsed, null, 2));

      if (parsed.success) {
        console.log('\n SUCCESS! Message tamara bija number (8140349408) par successfully send thai gayo che!');
      } else {
        console.log('\n ERROR:', parsed.error);
      }
    } catch (e) {
      console.log('Raw Response:', responseBody);
    }
  });
});

req.on('error', (err) => {
  console.error('\n Failed to connect to server:', err.message);
  console.log('Krupa kari ne check karo ke "npm start" terminal ma chalu che ke nahi.');
});

req.write(payload);
req.end();
