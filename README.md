# Safe Vault - WhatsApp Automation Microservice

A production-ready, modular Node.js REST API microservice built with **Express.js**, **whatsapp-web.js**, and **Puppeteer (Headless)** for integrating unofficial WhatsApp messaging into **Safe Vault Software**.

---

## 🚀 Features

- **One-Time QR Login**: Generates a standard QR code on first startup.
- **Session Persistence**: Utilizes `LocalAuth` to store sessions in `./.wwebjs_auth`. Once scanned, subsequent server restarts resume automatically without needing another scan.
- **RESTful Endpoints**:
  - `GET /api/status`: Real-time status (`CONNECTED`, `QR_READY`, `INITIALIZING`, `DISCONNECTED`).
  - `GET /api/qr`: QR code endpoint returning JSON (base64 Data URL) or a clean HTML preview in the browser.
  - `POST /api/send-message`: Single message delivery with phone number sanitization and WhatsApp registration check.
  - `POST /api/send-bulk`: Sequential multi-recipient message dispatch with **Anti-Ban Jitter Delay** (2.5s - 4.5s random intervals).
  - `POST /api/logout`: Reset and clear the saved WhatsApp session.
- **Anti-Ban Guardrails**: Automatic contact verification, presence simulation (natural typing state), and configurable sequential delays.
- **Optional Security**: Protect API endpoints using an optional API key (`x-api-key`).
- **Clean Shutdown**: Graceful cleanup handlers (`SIGINT`, `SIGTERM`) to terminate headless Puppeteer and prevent orphan browser processes.

---

## 📁 Project Architecture

```
whatsapp_api/
├── .env                  # Active environment variables
├── .env.example          # Template environment file
├── .gitignore            # Git exclusions (.wwebjs_auth, node_modules, etc.)
├── package.json          # Dependencies and scripts
├── index.js              # Application entry point
├── README.md             # Documentation and integration guide
└── src/
    ├── config.js         # Centralized configuration loader
    ├── server.js         # Express app bootstrap & lifecycle management
    ├── controllers/
    │   └── whatsappController.js # Request/Response orchestration
    ├── services/
    │   └── whatsappService.js    # WhatsApp Web client, LocalAuth & Puppeteer
    ├── routes/
    │   └── apiRoutes.js          # REST API route definitions
    └── middlewares/
        ├── authMiddleware.js     # Optional API key verification
        └── errorHandler.js       # Centralized error & 404 handlers
```

---

## 🛠️ Step-by-Step Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.0.0 or later installed (`node -v`)
- **NPM**: v9.0.0 or later (`npm -v`)
- **Internet connection** for downloading Chromium and WhatsApp Web assets.

### 2. Installation
Open a terminal in the project directory (`d:\project\whatsapp_api`) and run:

```bash
npm install
```

### 3. Configure Environment Variables
Review or edit `.env`:

```env
PORT=3000
API_KEY=
SESSION_ID=safevault-session
RATE_LIMIT_MIN_DELAY_MS=2500
RATE_LIMIT_MAX_DELAY_MS=4500
HEADLESS=true
```

*(Note: Leave `API_KEY` empty during local testing. For production, assign a secure token like `API_KEY=sv_secret_998877`).*

### 4. Start the Service

For production:
```bash
npm start
```

For development (auto-reload on code changes):
```bash
npm run dev
```

### 5. Pair WhatsApp Account (First Time Only)
1. Open your browser and navigate to:
   ```
   http://localhost:3000/api/qr
   ```
2. Open **WhatsApp** on your mobile phone.
3. Tap **Menu (⋮)** on Android or **Settings** on iOS.
4. Select **Linked Devices** > **Link a Device**.
5. Scan the QR code displayed on the screen.
6. Once paired, the page will show **WhatsApp is Connected!** and the session will be saved in `./.wwebjs_auth`.

---

## 📡 API Reference

### Admin Login and Forgot Password

The dashboard and all WhatsApp APIs require an administrator login. Account details and password/recovery hashes are stored in `data/admin.json`.

**Login:** `POST /api/auth/login`

```json
{ "username": "admin", "password": "your-password" }
```

**Forgot password:** `POST /api/auth/forgot-password`

```json
{
  "username": "admin",
  "email": "admin@safevault.local",
  "recoveryCode": "your-recovery-code",
  "newPassword": "minimum-8-characters"
}
```

After recovery verification, the password hash is updated dynamically in `data/admin.json`.

### 1. Check Connection Status
**Endpoint:** `GET /api/status`

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "CONNECTED",
    "isConnected": true,
    "qrReady": false,
    "clientInfo": {
      "pushname": "Safe Vault Admin",
      "phone": "919876543210",
      "platform": "Android"
    },
    "lastConnectedAt": "2026-09-18T10:30:00.000Z",
    "lastDisconnectedAt": null
  }
}
```

---

### 2. Retrieve QR Code
**Endpoint:** `GET /api/qr`

- **In Browser**: Renders an auto-refreshing QR code scanning interface.
- **In JSON Client**:
```json
{
  "success": true,
  "status": "QR_READY",
  "qrRaw": "2@bC...==",
  "qrDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

### 3. Send Single Message
**Endpoint:** `POST /api/send-message`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: your-api-key` *(if API_KEY is set in .env)*

**Request Body:**
```json
{
  "phoneNumber": "+91 98765 43210",
  "message": "Hello from Safe Vault Software! Your backup was completed successfully."
}
```
*(Phone number can include spaces, +, or dashes; the service sanitizes it automatically to international standard).*

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "success": true,
    "messageId": "true_919876543210@c.us_3EB0123456789ABCDEF0",
    "recipient": "919876543210",
    "timestamp": 1726656000
  }
}
```

**Error Response (`400 Bad Request` if number not on WhatsApp):**
```json
{
  "success": false,
  "error": "Phone number 919876543210 is not registered on WhatsApp."
}
```

---

### 4. Send Bulk Messages (With Anti-Ban Protection)
**Endpoint:** `POST /api/send-bulk`

**Format A: Same message to multiple numbers**
```json
{
  "phoneNumbers": [
    "919876543210",
    "919876543211",
    "919876543212"
  ],
  "message": "Safe Vault Alert: Scheduled maintenance is tonight at 11:00 PM."
}
```

**Format B: Personalized message per recipient**
```json
{
  "recipients": [
    {
      "phoneNumber": "919876543210",
      "message": "Hello Alice, your Safe Vault renewal invoice is ready."
    },
    {
      "phoneNumber": "919876543211",
      "message": "Hello Bob, your Safe Vault storage quota is at 85%."
    }
  ],
  "options": {
    "minDelayMs": 3000,
    "maxDelayMs": 5000
  }
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Bulk messaging completed: 2/2 delivered successfully",
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "phoneNumber": "919876543210",
        "status": "sent",
        "messageId": "true_919876543210@c.us_3EB0...",
        "timestamp": 1726656005
      },
      {
        "phoneNumber": "919876543211",
        "status": "sent",
        "messageId": "true_919876543211@c.us_3EB1...",
        "timestamp": 1726656010
      }
    ]
  }
}
```

---

### 5. Logout & Reset Session
**Endpoint:** `POST /api/logout`

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 💻 Integration Guide for Safe Vault Software

### Option 1: JavaScript / TypeScript (Fetch / Axios)

```javascript
// Using Native fetch in Node.js, Electron, or Web
async function sendSafeVaultAlert(phoneNumber, messageText) {
  const url = 'http://localhost:3000/api/send-message';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'x-api-key': 'your-secret-api-key' // if configured
    },
    body: JSON.stringify({
      phoneNumber: phoneNumber,
      message: messageText
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send WhatsApp message');
  }

  return data;
}

// Example usage:
sendSafeVaultAlert('919876543210', 'Vault item #4412 updated.')
  .then(res => console.log('Message delivered:', res.data.messageId))
  .catch(err => console.error('Error:', err.message));
```

---

### Option 2: C# (.NET Desktop / WPF / Windows Forms / ASP.NET)

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class SafeVaultWhatsAppClient
{
    private static readonly HttpClient client = new HttpClient();
    private const string BaseUrl = "http://localhost:3000/api";

    public async Task<bool> SendMessageAsync(string phoneNumber, string message)
    {
        var payload = new
        {
            phoneNumber = phoneNumber,
            message = message
        };

        var jsonContent = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        // If you enabled API_KEY:
        // client.DefaultRequestHeaders.Add("x-api-key", "your-secret-api-key");

        var response = await client.PostAsync($"{BaseUrl}/send-message", jsonContent);
        var responseString = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"WhatsApp Error: {responseString}");
            return false;
        }

        Console.WriteLine($"Success: {responseString}");
        return true;
    }
}
```

---

### Option 3: Python (requests)

```python
import requests

BASE_URL = "http://localhost:3000/api"

def send_whatsapp_message(phone_number: str, message: str):
    url = f"{BASE_URL}/send-message"
    headers = {
        "Content-Type": "application/json",
        # "x-api-key": "your-api-key"
    }
    payload = {
        "phoneNumber": phone_number,
        "message": message
    }
    
    response = requests.post(url, json=payload, headers=headers)
    response_data = response.json()
    
    if response.status_code == 200 and response_data.get("success"):
        print(f"Delivered! Message ID: {response_data['data']['messageId']}")
        return response_data
    else:
        print(f"Failed to send: {response_data.get('error')}")
        return None
```

---

## 🛡️ Anti-Ban Best Practices for 50-60 Daily Messages

1. **Jitter Delay is Mandatory**: Never send 50 messages in rapid succession. The built-in `/api/send-bulk` endpoint enforces a randomized 2.5s - 4.5s delay between messages.
2. **Warm-Up New Numbers**: If using a newly activated SIM card, send only 5-10 messages on day 1, 20 on day 2, and ramp up to 50-60 over 4-5 days.
3. **Avoid Unregistered Numbers**: The service checks `isRegisteredUser` before sending. If a number isn't on WhatsApp, it skips it to protect your account reputation.
4. **Personalize Content**: Messages that are 100% identical look like bot broadcasts. Use personalized salutations (e.g. `Hello John...`) using the `recipients` array format.
5. **Keep Device Connected**: Ensure your mobile phone has an active internet connection and battery saver isn't putting WhatsApp to sleep.
