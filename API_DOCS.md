# Safe Vault WhatsApp REST API - Official Documentation

Welcome to the **Safe Vault WhatsApp Automation Microservice** API reference. This document provides complete endpoint specifications, request/response formats, error codes, and code examples for integrating WhatsApp messaging into **Safe Vault Software** or any third-party system.

---

## 🌐 Base URL & Server Info

- **Base URL:** `http://localhost:3000` (or your production server domain/IP)
- **Web UI Dashboard:** `http://localhost:3000/`
- **Content-Type:** `application/json`
- **Default Port:** `3000` (configurable in `.env`)

---

## 🔐 Authentication

All WhatsApp API routes require the HTTP-only administrator session created by dashboard login.

### Admin Login

`POST /api/auth/login`

```json
{ "username": "admin", "password": "your-password" }
```

### Forgot Password

`POST /api/auth/forgot-password`

```json
{
  "username": "admin",
  "email": "admin@safevault.local",
  "recoveryCode": "your-recovery-code",
  "newPassword": "minimum-8-characters"
}
```

After verification, the password hash is updated dynamically in `data/admin.json`.

---

## 📑 Summary of Endpoints

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Create administrator session | Public |
| `POST` | `/api/auth/forgot-password` | Reset password after recovery verification | Public |
| `GET`/`POST` | `/api/send` | **SendBuddy Compatible API** (Dispatch via `instance_id` & `access_token`) | Public / Token |
| `GET` | `/scan.html` | Public standalone QR scan page for client device pairing | Public |
| `GET` | `/api/instances` | List all WhatsApp client instances | Admin |
| `POST` | `/api/instances` | Create new client instance and generate credentials | Admin |
| `GET` | `/api/instances/:id/qr` | Get QR code and live connection status for instance | Admin |
| `POST` | `/api/instances/:id/reset` | Clear instance session and generate fresh QR | Admin |
| `DELETE` | `/api/instances/:id` | Delete instance and remove all session files | Admin |
| `GET` | `/api/status` | Check WhatsApp client connection status and device details | Admin |
| `GET` | `/api/qr` | Get current pairing QR code (JSON or Browser HTML view) | Admin |
| `POST` | `/api/send-message` | Send a single WhatsApp message to one number | Admin |
| `POST` | `/api/send-bulk` | Send bulk WhatsApp messages with 4-5s Anti-Ban jitter delay | Admin |
| `GET` | `/api/reset-session` | Clear session cache and generate fresh QR code | Admin |
| `POST` | `/api/logout` | Disconnect WhatsApp client and clear session | Admin |
| `GET` | `/api/health` | Health check endpoint returning microservice info | Admin |

---

## 🚀 SendBuddy Compatible Dispatch API

Use this endpoint to connect existing desktop software (VB.NET, C#, Python, PHP) using your original SendBuddy URL structure:

- **Method:** `GET` or `POST`
- **Path:** `/api/send`
- **Authentication:** `instance_id` + `access_token` query or body parameters (no admin cookie required)

### Request URL Format:
```text
http://<your-server>/whatsapp_api/api/send?number=919876543210&type=text&message=Your+message+here&instance_id=679B485A1510B&access_token=679b262160af7
```

### Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `number` (or `phone`) | string | **Yes** | Recipient mobile number with country code (e.g. `919876543210`) |
| `type` | string | No | Message type (`text` default) |
| `message` | string | **Yes** | Text message content (URL-encoded) |
| `instance_id` | string | **Yes** | Client WhatsApp instance identifier |
| `access_token` | string | **Yes** | Instance secret authorization token |

### VB.NET / C# Code Example:
```vb
Dim strMobileNo As String = "919876543210"
Dim strMessage As String = "Invoice #1042 has been generated."
Dim strInstance As String = "679B485A1510B"
Dim strToken As String = "679b262160af7"

Dim requestUrl As String = "http://93.127.198.184/whatsapp_api/api/send?number=" & strMobileNo & "&type=text&message=" & Uri.EscapeDataString(strMessage) & "&instance_id=" & strInstance & "&access_token=" & strToken

Dim client As New System.Net.WebClient()
Dim response As String = client.DownloadString(requestUrl)
```

### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Message sent successfully",
  "data": {
    "id": "false_919876543210@c.us_3EB0C5D8...",
    "to": "919876543210",
    "from": "919427758870",
    "type": "text",
    "timestamp": 1758450000
  }
}
```

### Error Response (`400` / `401`):
```json
{
  "status": "error",
  "message": "Invalid access_token or WhatsApp instance is not connected."
}
```

---

## 📖 Endpoint Details

### 1. Connection Status
Checks whether the WhatsApp client is currently connected and ready to transmit messages.

- **Method:** `GET`
- **Path:** `/api/status`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "status": "CONNECTED",
    "isConnected": true,
    "qrReady": false,
    "clientInfo": {
      "pushname": "Yash V Gajera",
      "phone": "919427758870",
      "platform": "android"
    },
    "lastConnectedAt": "2026-09-18T10:49:55.815Z",
    "lastDisconnectedAt": null
  }
}
```

#### Possible `status` values:
- `CONNECTED`: Ready to send and receive messages.
- `AUTHENTICATING`: Linked session is loading from local cache.
- `QR_READY`: Waiting for user to scan pairing QR code.
- `INITIALIZING`: Headless Chromium is booting up.
- `DISCONNECTED`: Phone disconnected or session invalidated.

---

### 2. Pairing QR Code
Retrieves the QR code needed to pair a phone with the microservice.

- **Method:** `GET`
- **Path:** `/api/qr`
- **Query Parameter (Optional):** `?format=html` (Forces HTML view)

#### Behavior:
- **In Web Browser:** Renders a clean, auto-refreshing QR scanning page.
- **In API Request (JSON):**

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
Dispatches a text message to a single WhatsApp contact.

- **Method:** `POST`
- **Path:** `/api/send-message`
- **Headers:** `Content-Type: application/json`

#### Request Body:
```json
{
  "phoneNumber": "918140349408",
  "message": "Hello from Safe Vault Software! Your backup completed successfully."
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `phoneNumber` | String | **Yes** | Destination number with country code (e.g. `918140349408` or `+91 81403 49408`). Non-digits are automatically stripped. |
| `message` | String | **Yes** | Message text to deliver. Supports WhatsApp markdown (`*bold*`, `_italic_`, `~strike~`, ` ```code``` `). |

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "success": true,
    "messageId": "true_918140349408@c.us_3EB0123456789ABCDEF0",
    "recipient": "918140349408",
    "timestamp": 1726658000
  }
}
```

#### Error Responses:
- `400 Bad Request`: Number is not registered on WhatsApp.
  ```json
  { "success": false, "error": "Phone number 918140349408 is not registered on WhatsApp." }
  ```
- `503 Service Unavailable`: WhatsApp client is not connected.
  ```json
  { "success": false, "error": "WhatsApp client is not ready. Current status: DISCONNECTED. Please scan QR code first." }
  ```

---

### 4. Send Bulk Messages (With 4-5s Anti-Ban Delay)
Sends messages to multiple contacts sequentially with randomized anti-spam jitter delay.

- **Method:** `POST`
- **Path:** `/api/send-bulk`
- **Headers:** `Content-Type: application/json`

#### Request Body - Option A: Same message to multiple numbers
```json
{
  "phoneNumbers": [
    "918140349408",
    "919727899812",
    "919876543210"
  ],
  "message": "Safe Vault Alert: Scheduled server maintenance is tonight at 11:00 PM.",
  "options": {
    "minDelayMs": 4000,
    "maxDelayMs": 5500
  }
}
```

#### Request Body - Option B: Personalized message per contact
```json
{
  "recipients": [
    {
      "phoneNumber": "918140349408",
      "message": "Hello Ramesh, your Safe Vault renewal is confirmed."
    },
    {
      "phoneNumber": "919727899812",
      "message": "Hello Suresh, your storage quota is at 80%."
    }
  ],
  "options": {
    "minDelayMs": 4000,
    "maxDelayMs": 5000
  }
}
```

#### Success Response (`200 OK`):
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
        "phoneNumber": "918140349408",
        "status": "sent",
        "messageId": "true_918140349408@c.us_3EB0...",
        "timestamp": 1726658005
      },
      {
        "phoneNumber": "919727899812",
        "status": "sent",
        "messageId": "true_919727899812@c.us_3EB1...",
        "timestamp": 1726658010
      }
    ]
  }
}
```

---

### 5. Reset Session & Force Fresh QR
Cleans `.wwebjs_auth` cache, closes Puppeteer, and restarts the engine to generate a brand new pairing QR code.

- **Method:** `GET`
- **Path:** `/api/reset-session`

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Session reset. Generating fresh QR code..."
}
```
*(If accessed from a browser, it automatically redirects you back to `/api/qr`).*

---

### 6. Logout Session
Gracefully logs out from WhatsApp Web and disconnects the browser.

- **Method:** `POST`
- **Path:** `/api/logout`

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 💻 Code Examples for "Safe Vault Software"

### C# (.NET Core / WPF / WinForms / ASP.NET)

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class SafeVaultWhatsAppClient
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private const string ApiBaseUrl = "http://localhost:3000/api";

    // 1. Send Single Message
    public async Task<bool> SendMessageAsync(string phoneNumber, string message)
    {
        var payload = new
        {
            phoneNumber = phoneNumber,
            message = message
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync($"{ApiBaseUrl}/send-message", content);

        return response.IsSuccessStatusCode;
    }

    // 2. Send Bulk Messages
    public async Task<string> SendBulkAsync(string[] phoneNumbers, string message, int minDelayMs = 4000, int maxDelayMs = 5000)
    {
        var payload = new
        {
            phoneNumbers = phoneNumbers,
            message = message,
            options = new { minDelayMs = minDelayMs, maxDelayMs = maxDelayMs }
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync($"{ApiBaseUrl}/send-bulk", content);

        return await response.Content.ReadAsStringAsync();
    }
}
```

---

### JavaScript / TypeScript (Node.js / Electron / React / Vue)

```javascript
const API_BASE = 'http://localhost:3000/api';

// Send Single Message
async function sendWhatsAppAlert(phoneNumber, message) {
  const response = await fetch(`${API_BASE}/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, message })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to send');
  return data;
}

// Send Bulk Messages
async function sendBulkWhatsApp(phoneNumbers, message) {
  const response = await fetch(`${API_BASE}/send-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumbers,
      message,
      options: { minDelayMs: 4000, maxDelayMs: 5000 }
    })
  });

  return await response.json();
}
```

---

### Python (requests)

```python
import requests

API_BASE = "http://localhost:3000/api"

def send_whatsapp(phone_number: str, message: str):
    url = f"{API_BASE}/send-message"
    payload = {"phoneNumber": phone_number, "message": message}
    res = requests.post(url, json=payload)
    return res.json()

def send_bulk_whatsapp(numbers: list, message: str):
    url = f"{API_BASE}/send-bulk"
    payload = {
        "phoneNumbers": numbers,
        "message": message,
        "options": {"minDelayMs": 4000, "maxDelayMs": 5000}
    }
    res = requests.post(url, json=payload)
    return res.json()
```

---

## 🛡️ Anti-Ban Safety Rules for 50-60 Messages/Day

1. **4 to 5 Second Delay**: Always preserve the 4000-5000ms delay between consecutive messages. Never blast 50 messages in seconds.
2. **Contact Validation**: The API automatically checks if each number is on WhatsApp before attempting to send.
3. **Presence Simulation**: Humanized typing state is simulated before sending.
4. **Number Warmup**: If using a newly activated SIM, start with 15 messages on Day 1, 30 on Day 2, and 50-60 on Day 3 onwards.
