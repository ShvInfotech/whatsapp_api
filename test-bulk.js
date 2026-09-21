/**
 * Test script to send WhatsApp messages to MULTIPLE numbers (Bulk Send)
 * Run: node test-bulk.js
 */

const http = require('http');

// 1. Array of phone numbers to send messages to
const phoneNumbers = [
  '918140349408', // Number 1
  '919727899812'  // Number 2 (or any other client/test numbers)
];

// 2. Common message to send to all numbers
const broadcastMessage = 'Hello! This is a bulk test message sent via Safe Vault WhatsApp API.';

// Or OPTION B: Personalized message per user
// const payload = JSON.stringify({
//   recipients: [
//     { phoneNumber: '918140349408', message: 'Hello! Safe Vault Alert for Account A' },
//     { phoneNumber: '919876543210', message: 'Hello! Safe Vault Alert for Account B' }
//   ]
// });

const payload = JSON.stringify({
  phoneNumbers: phoneNumbers,
  message: broadcastMessage,
  options: {
    minDelayMs: 2500, // 2.5 seconds minimum wait between messages
    maxDelayMs: 4500  // 4.5 seconds maximum wait (Anti-Ban protection)
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-bulk',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log(`Starting bulk send to ${phoneNumbers.length} numbers...`);
console.log('Notice: Each message will have a 2.5 - 4.5 second delay to avoid WhatsApp spam bans.\n');

const req = http.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('HTTP Status Code:', res.statusCode);
    try {
      const parsed = JSON.parse(responseBody);
      console.log('Summary Result:\n', JSON.stringify(parsed, null, 2));

      if (parsed.success && parsed.data && parsed.data.successful > 0) {
        console.log(`\n SUCCESS! ${parsed.data.successful}/${parsed.data.total} messages delivered successfully!`);
      } else {
        console.log(`\n FAILED: ${parsed.data ? parsed.data.failed : 0} messages failed.`);
      }
    } catch (e) {
      console.log('Raw Response:', responseBody);
    }
  });
});

req.on('error', (err) => {
  console.error('\n Failed to connect to server:', err.message);
  console.log('Make sure "npm start" is running in the terminal.');
});

req.write(payload);
req.end();
