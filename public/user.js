const auth = document.getElementById('userAuth');
const dashboard = document.getElementById('userDashboard');
const loginForm = document.getElementById('userLoginForm');
const registerForm = document.getElementById('userRegisterForm');
const userAuthError = document.getElementById('userAuthError');
const registerError = document.getElementById('registerError');
let myInstance;
let pollTimer;
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-user-tab]');
  if (!tabBtn) return;
  const targetId = tabBtn.dataset.userTab;
  document.querySelectorAll('[data-user-tab]').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.user-tab-panel').forEach((panel) => panel.classList.remove('active'));
  tabBtn.classList.add('active');
  document.getElementById(targetId)?.classList.add('active');
});

const getApiBaseUrl = () => {
  if (window.API_BASE_URL !== undefined) return window.API_BASE_URL;
  const path = window.location.pathname.replace(/\/(user|scan|index|admin|dashboard)?(\.(php|html))?\/?$/, '');
  return path || '';
};
const API_BASE_URL = getApiBaseUrl();

async function api(endpoint, options) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, { credentials: 'include', ...options });
  response.safeJson = async () => {
    try {
      return await response.json();
    } catch (_) {
      return { success: false, error: `Server error (${response.status})` };
    }
  };
  return response;
}
function showError(element, message) { element.textContent = message; element.classList.remove('hidden'); }
function showLogin() { loginForm.classList.remove('hidden'); registerForm.classList.add('hidden'); }
function showRegister() { registerForm.classList.remove('hidden'); loginForm.classList.add('hidden'); }

document.getElementById('showRegister').addEventListener('click', showRegister);
document.getElementById('showUserLogin').addEventListener('click', showLogin);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); userAuthError.classList.add('hidden');
  const response = await api('/api/user-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userLoginUsername.value, password: userLoginPassword.value }) });
  const data = await response.safeJson();
  if (!response.ok) return showError(userAuthError, data.error || 'Login failed.');
  openDashboard(data.data);
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault(); registerError.classList.add('hidden');
  const response = await api('/api/user-auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: registerFullName.value, username: registerUsername.value, email: registerEmail.value, password: registerPassword.value }) });
  const data = await response.safeJson();
  if (!response.ok) return showError(registerError, data.error || 'Registration failed.');
  showLogin(); userLoginUsername.value = registerUsername.value; userLoginPassword.value = ''; showError(userAuthError, 'Registration complete. Please login.');
});

async function openDashboard(user) {
  auth.classList.add('hidden'); dashboard.classList.remove('hidden');
  document.getElementById('welcomeUser').textContent = `Signed in as ${user.fullName} (@${user.username})`;
  const response = await api('/api/user/instances'); const data = await response.safeJson();
  if (!response.ok || !data.data || !data.data.length) {
    document.getElementById('instanceStatus').textContent = data.error || 'Your WhatsApp instance is unavailable.';
    document.getElementById('userNavStatus').textContent = 'Instance unavailable';
    return;
  }
  myInstance = data.data[0]; document.getElementById('instanceName').textContent = myInstance.name;
  initApiDocsTab(myInstance);
  refreshQr();
}

async function refreshQr() {
  if (!myInstance) return;
  try {
    const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/qr`);
    const data = await response.safeJson();
    if (!response.ok) throw new Error(data.error);
    const info = data.data;
    const isAuthenticating = info.status === 'AUTHENTICATING';
    const isConnected = !!info.isConnected;
    updateApiDocsStatus(isConnected, info);

    document.getElementById('instanceStatus').textContent = isConnected
      ? 'Status: CONNECTED'
      : (isAuthenticating ? 'Status: AUTHENTICATING (Syncing...)' : `Status: ${info.status}`);

    document.getElementById('userNavStatus').textContent = isConnected
      ? 'WhatsApp Connected'
      : (isAuthenticating ? 'Syncing WhatsApp...' : (info.qrReady ? 'Scan QR to Connect' : 'Preparing WhatsApp'));

    const image = document.getElementById('userQrImage');
    const loader = document.getElementById('userQrLoader');
    const loaderText = document.getElementById('userQrLoaderText');
    const connected = document.getElementById('connectedInfo');
    const appLink = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(myInstance.id)}&access_token=${encodeURIComponent(myInstance.accessToken)}`;

    document.getElementById('userAppLinkText').textContent = appLink;
    document.getElementById('copyUserAppLink').classList.toggle('hidden', !isConnected);
    document.getElementById('userAppLinkBox').classList.toggle('hidden', !isConnected);
    document.getElementById('userQrSteps').classList.toggle('hidden', isConnected);
    document.getElementById('userConnectedVisual').classList.toggle('hidden', !isConnected);
    document.getElementById('userQrAutoRefresh').classList.toggle('hidden', isConnected);
    document.getElementById('userQrFrame').classList.toggle('user-connected-frame', isConnected);

    document.getElementById('userHeroDescription').textContent = isConnected
      ? 'Your WhatsApp account is securely connected. You can now send single or bulk messages from this workspace.'
      : (isAuthenticating
          ? 'Mobile scanned! Logging in and synchronizing WhatsApp session, please wait a moment...'
          : 'Connect your personal WhatsApp account securely. This workspace never displays or uses another user\'s WhatsApp session.');

    if (isConnected) {
      image.classList.add('hidden');
      loader.classList.add('hidden');
      connected.textContent = `✓ Connected as ${info.pushname || 'WhatsApp user'} ${info.phone ? `(+${info.phone})` : ''}`;
      connected.classList.remove('hidden');
    } else if (info.qrDataUrl && !isAuthenticating) {
      image.src = info.qrDataUrl;
      image.classList.remove('hidden');
      loader.classList.add('hidden');
      connected.classList.add('hidden');
    } else {
      image.classList.add('hidden');
      loader.classList.remove('hidden');
      connected.classList.add('hidden');
      if (loaderText) {
        loaderText.textContent = isAuthenticating
          ? (info.loadingPercent ? `Syncing chats (${info.loadingPercent}%)...` : 'Phone connected! Finalizing login & sync...')
          : 'Loading QR Code...';
      }
    }
  } catch (error) {
    document.getElementById('instanceStatus').textContent = error.message || 'Unable to load your QR code.';
    document.getElementById('copyUserAppLink').classList.add('hidden');
    document.getElementById('userAppLinkBox').classList.add('hidden');
    document.getElementById('userConnectedVisual').classList.add('hidden');
    document.getElementById('userQrSteps').classList.remove('hidden');
    document.getElementById('userQrAutoRefresh').classList.remove('hidden');
    document.getElementById('userQrFrame').classList.remove('user-connected-frame');
  }
  pollTimer = setTimeout(refreshQr, 2500);
}

document.getElementById('resetMySession').addEventListener('click', async () => { if (!myInstance || !confirm('Reset your WhatsApp session?')) return; await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/reset`, { method: 'POST' }); refreshQr(); });
document.getElementById('userLogout').addEventListener('click', async () => { clearTimeout(pollTimer); await api('/api/user-auth/logout', { method: 'POST' }); location.reload(); });
document.getElementById('copyUserAppLink').addEventListener('click', async () => {
  if (!myInstance?.id || !myInstance?.accessToken) return;
  const link = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(myInstance.id)}&access_token=${encodeURIComponent(myInstance.accessToken)}`;
  try { await navigator.clipboard.writeText(link); document.getElementById('copyUserAppLink').textContent = 'App API Link Copied!'; }
  catch (_) { alert('Could not copy the app API link.'); }
  setTimeout(() => { document.getElementById('copyUserAppLink').textContent = 'Copy App API Link'; }, 2000);
});

function setResult(id, message, isError = false) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.classList.remove('hidden');
  element.style.color = isError ? '#fca5a5' : '#a7f3d0';
}

const userSingleForm = document.getElementById('userSingleForm');
const userSingleMsgInput = document.getElementById('userSingleMessage');
const userSinglePhoneInput = document.getElementById('userSinglePhone');

function updateSinglePreview() {
  const preview = document.getElementById('userSinglePreview');
  const previewTime = document.getElementById('userSinglePreviewTime');
  const charBadge = document.getElementById('userSingleCharBadge');
  const text = userSingleMsgInput ? userSingleMsgInput.value : '';

  if (charBadge) charBadge.textContent = `${text.length} Chars`;
  if (preview) preview.textContent = text.trim() ? text : 'Type message to preview...';
  if (previewTime) previewTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

if (userSinglePhoneInput) {
  userSinglePhoneInput.addEventListener('input', () => {
    const recipient = document.getElementById('previewRecipientName');
    const digits = userSinglePhoneInput.value.replace(/\D/g, '');
    if (recipient) {
      recipient.textContent = digits.length >= 6 ? `+${digits}` : 'Recipient';
    }
  });
}

if (userSingleMsgInput) {
  userSingleMsgInput.addEventListener('input', updateSinglePreview);
}

// Quick Templates for Single Message
const singleTemplates = {
  greeting: "Hello! 👋 Thank you for connecting with us. How can we assist you today?",
  payment: "Dear Customer, this is a friendly reminder that your payment is due. Please review your account for details. Thank you! 💳",
  order: "Great news! 🛍️ Your order has been processed and is on its way. Track your package anytime. Thank you for choosing us!",
  meeting: "Hi there! 📅 Confirming our upcoming meeting scheduled for today. Looking forward to our conversation!"
};

document.querySelectorAll('[data-tpl]').forEach((chip) => {
  chip.addEventListener('click', () => {
    const tplKey = chip.dataset.tpl;
    const msg = singleTemplates[tplKey];
    if (msg && userSingleMsgInput) {
      userSingleMsgInput.value = msg;
      updateSinglePreview();
      userSingleMsgInput.focus();
    }
  });
});

// Single Message Formatting Toolbar
document.querySelectorAll('[data-single-fmt]').forEach((button) => {
  button.addEventListener('click', () => {
    const marks = { bold: '*', italic: '_', strike: '~', mono: '```' };
    const mark = marks[button.dataset.singleFmt];
    if (!userSingleMsgInput || !mark) return;
    const start = userSingleMsgInput.selectionStart;
    const end = userSingleMsgInput.selectionEnd;
    const selected = userSingleMsgInput.value.slice(start, end) || 'text';
    userSingleMsgInput.setRangeText(`${mark}${selected}${mark}`, start, end, 'end');
    userSingleMsgInput.focus();
    updateSinglePreview();
  });
});

document.getElementById('clearSingleMsg')?.addEventListener('click', () => {
  if (userSingleMsgInput) {
    userSingleMsgInput.value = '';
    updateSinglePreview();
    userSingleMsgInput.focus();
  }
});

if (userSingleForm) {
  userSingleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('userSendSingle');
    button.disabled = true;
    try {
      const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: document.getElementById('userSinglePhone').value.trim(), message: document.getElementById('userSingleMessage').value.trim() })
      });
      const data = await response.safeJson();
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      setResult('userSingleResult', 'Message sent successfully.');
      event.target.reset();
      updateSinglePreview();
      const recipient = document.getElementById('previewRecipientName');
      if (recipient) recipient.textContent = 'Recipient';
    } catch (error) { setResult('userSingleResult', error.message, true); }
    finally { button.disabled = false; }
  });
}

const userBulkForm = document.getElementById('userBulkForm');
const userBulkNumbers = document.getElementById('userBulkNumbers');
const userBulkMessage = document.getElementById('userBulkMessage');
const userDelayRange = document.getElementById('userDelayRange');

if (userBulkForm && userBulkNumbers && userBulkMessage && userDelayRange) {
  function parseUserNumbers() {
    return userBulkNumbers.value.split(/[\r\n,\s]+/).map((value) => value.replace(/\D/g, '')).filter((value, index, list) => value.length >= 10 && list.indexOf(value) === index).slice(0, 100);
  }
  function updateUserBulkCounts() {
    const numbers = parseUserNumbers();
    document.getElementById('userNumberCountBadge').textContent = `${numbers.length} Number${numbers.length === 1 ? '' : 's'}`;
    document.getElementById('userCharCountBadge').textContent = `${userBulkMessage.value.length} Chars`;
  }
  function updateUserDelay() {
    const delay = Number(userDelayRange.value);
    document.getElementById('userSliderVal').textContent = `${delay}s`;
    document.getElementById('userDelayDisplay').textContent = `${Math.max(1, Math.floor(delay - .5))} - ${Math.ceil(delay + .5)} Seconds`;
  }
  function updateUserBulkProgress(completed, total, sent, failed) {
    const percent = total ? Math.round((completed / total) * 100) : 0;
    document.getElementById('userProgressSummary').textContent = `${completed} of ${total} Completed`;
    document.getElementById('userProgressPercent').textContent = `${percent}%`;
    document.getElementById('userProgressBar').style.width = `${percent}%`;
    document.getElementById('userStatTotal').textContent = total;
    document.getElementById('userStatSent').textContent = sent;
    document.getElementById('userStatFailed').textContent = failed;
    document.getElementById('userStatRemaining').textContent = Math.max(0, total - completed);
  }
  userBulkNumbers.addEventListener('input', updateUserBulkCounts);
  userBulkMessage.addEventListener('input', updateUserBulkCounts);
  userDelayRange.addEventListener('input', updateUserDelay);
  document.getElementById('userClearNumbers')?.addEventListener('click', () => { userBulkNumbers.value = ''; updateUserBulkCounts(); });
  document.getElementById('userClearLog')?.addEventListener('click', () => { document.getElementById('userLogTableBody').innerHTML = '<tr class="empty-row"><td colspan="4">Log cleared. Ready for next dispatch.</td></tr>'; });
  document.querySelectorAll('[data-user-fmt]').forEach((button) => button.addEventListener('click', () => {
    const marks = { bold: '*', italic: '_', strike: '~', mono: '```' }; const mark = marks[button.dataset.userFmt];
    const start = userBulkMessage.selectionStart; const end = userBulkMessage.selectionEnd; const selected = userBulkMessage.value.slice(start, end) || 'text';
    userBulkMessage.setRangeText(`${mark}${selected}${mark}`, start, end, 'end'); userBulkMessage.focus(); updateUserBulkCounts();
  }));

  userBulkForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('userSendBulk'); const phoneNumbers = parseUserNumbers(); const message = userBulkMessage.value.trim();
    if (!phoneNumbers.length || !message) return setResult('userBulkResult', 'Add at least one valid number and a message.', true);
    button.disabled = true; const state = document.getElementById('userExecStateBadge'); state.className = 'badge badge-running'; state.textContent = 'Sending...';
    updateUserBulkProgress(0, phoneNumbers.length, 0, 0); document.getElementById('userLogTableBody').innerHTML = phoneNumbers.map((number, index) => `<tr><td>${index + 1}</td><td>${number}</td><td class="text-muted">Queued</td><td>-</td></tr>`).join('');
    try {
      const delayMs = Number(userDelayRange.value) * 1000;
      const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumbers, message, options: { minDelayMs: Math.max(1000, delayMs - 500), maxDelayMs: delayMs + 500 } }) });
      const data = await response.safeJson(); if (!response.ok) throw new Error(data.error || 'Bulk messages could not be sent.');
      const results = data.data?.results || []; let sent = 0; let failed = 0;
      document.getElementById('userLogTableBody').innerHTML = results.map((result, index) => { const ok = result.status === 'sent'; if (ok) sent += 1; else failed += 1; return `<tr><td>${index + 1}</td><td>${result.phoneNumber}</td><td class="${ok ? 'status-sent' : 'status-failed'}">${ok ? 'Sent' : 'Failed'}</td><td>${ok ? 'Delivered to WhatsApp' : (result.error || 'Could not send')}</td></tr>`; }).join('');
      updateUserBulkProgress(results.length, phoneNumbers.length, sent, failed); state.className = 'badge badge-completed'; state.textContent = 'Completed'; setResult('userBulkResult', data.message || 'Bulk sending completed.');
    } catch (error) { state.className = 'badge badge-stopped'; state.textContent = 'Failed'; setResult('userBulkResult', error.message, true); }
    finally { button.disabled = false; }
  });

  updateUserBulkCounts();
  updateUserDelay();
}

/* ==========================================================================
   API Documentation Tab Logic
   ========================================================================== */
let isTokenRevealed = false;
let activeSnippetLang = 'vb';

function getSnippets(instance) {
  const origin = window.location.origin;
  const id = instance?.id || 'YOUR_INSTANCE_ID';
  const token = instance?.accessToken || 'YOUR_ACCESS_TOKEN';

  return {
    vb: {
      title: 'VB.NET (Desktop Software / WinForms / WPF)',
      code: `' VB.NET WhatsApp API Integration
Dim strMobileNo As String = "919876543210"
Dim strMessage As String = "Hello! Your invoice #1042 has been generated."
Dim strInstance As String = "${id}"
Dim strToken As String = "${token}"

Dim requestUrl As String = "${origin}/api/send?number=" & strMobileNo & "&type=text&message=" & Uri.EscapeDataString(strMessage) & "&instance_id=" & strInstance & "&access_token=" & strToken

Dim client As New System.Net.WebClient()
Dim response As String = client.DownloadString(requestUrl)
Console.WriteLine(response)`
    },
    csharp: {
      title: 'C# .NET (Console / ASP.NET / Desktop)',
      code: `// C# .NET WhatsApp API Integration
using System;
using System.Net.Http;
using System.Threading.Tasks;

using var client = new HttpClient();
string mobileNo = "919876543210";
string message = "Hello! Your invoice #1042 has been generated.";
string instanceId = "${id}";
string accessToken = "${token}";

string url = $"${origin}/api/send?number={mobileNo}&type=text&message={Uri.EscapeDataString(message)}&instance_id={instanceId}&access_token={accessToken}";

string response = await client.GetStringAsync(url);
Console.WriteLine(response);`
    },
    php: {
      title: 'PHP (cURL / file_get_contents)',
      code: `<?php
// PHP WhatsApp API Integration
$baseUrl = "${origin}/api/send";
$params = [
    'number'       => '919876543210',
    'type'         => 'text',
    'message'      => 'Hello! Your invoice #1042 has been generated.',
    'instance_id'  => '${id}',
    'access_token' => '${token}'
];

$requestUrl = $baseUrl . '?' . http_build_query($params);
$response = file_get_contents($requestUrl);
echo $response;
?>`
    },
    python: {
      title: 'Python (requests library)',
      code: `# Python WhatsApp API Integration
import requests

url = "${origin}/api/send"
params = {
    "number": "919876543210",
    "type": "text",
    "message": "Hello! Your invoice #1042 has been generated.",
    "instance_id": "${id}",
    "access_token": "${token}"
}

response = requests.get(url, params=params)
print(response.json())`
    },
    curl: {
      title: 'cURL (Terminal / Command Line)',
      code: `# cURL Terminal Command
curl -X GET "${origin}/api/send?number=919876543210&type=text&message=Hello+from+API&instance_id=${id}&access_token=${token}"`
    },
    js: {
      title: 'JavaScript / Node.js (fetch API)',
      code: `// Node.js / Modern JavaScript
const params = new URLSearchParams({
  number: '919876543210',
  type: 'text',
  message: 'Hello! Your invoice #1042 has been generated.',
  instance_id: '${id}',
  access_token: '${token}'
});

fetch('${origin}/api/send?' + params)
  .then(res => res.json())
  .then(data => console.log('API Response:', data))
  .catch(err => console.error('API Error:', err));`
    }
  };
}

function renderSnippet(lang) {
  activeSnippetLang = lang;
  const snippets = getSnippets(myInstance);
  const snippet = snippets[lang] || snippets.vb;
  const titleEl = document.getElementById('docSnippetTitle');
  const codeEl = document.getElementById('docSnippetCode');
  if (titleEl) titleEl.textContent = snippet.title;
  if (codeEl) codeEl.textContent = snippet.code;
}

function initApiDocsTab(instance) {
  if (!instance) return;
  const origin = window.location.origin;
  const docInstanceId = document.getElementById('docInstanceId');
  const docAccessToken = document.getElementById('docAccessToken');
  const docBaseUrl = document.getElementById('docBaseUrl');
  const docLiveUrl = document.getElementById('docLiveUrl');

  if (docInstanceId) docInstanceId.textContent = instance.id;
  if (docBaseUrl) docBaseUrl.textContent = origin;
  if (docAccessToken) {
    docAccessToken.textContent = isTokenRevealed ? instance.accessToken : '••••••••••••••••••••';
  }

  const liveUrl = `${origin}/api/send?number=91XXXXXXXXXX&type=text&message=Hello+from+Pixano+API&instance_id=${encodeURIComponent(instance.id)}&access_token=${encodeURIComponent(instance.accessToken)}`;
  if (docLiveUrl) docLiveUrl.textContent = liveUrl;

  renderSnippet(activeSnippetLang);
}

function updateApiDocsStatus(isConnected, info) {
  const statusPill = document.getElementById('docConnectionStatus');
  const statusText = document.getElementById('docStatusText');
  if (!statusPill || !statusText) return;

  if (isConnected) {
    statusPill.className = 'status-pill status-connected';
    statusText.textContent = `Connected (${info?.phone ? `+${info.phone}` : 'Active'})`;
  } else if (info?.status === 'AUTHENTICATING') {
    statusPill.className = 'status-pill status-loading';
    statusText.textContent = 'Syncing...';
  } else {
    statusPill.className = 'status-pill status-disconnected';
    statusText.textContent = 'Scan QR to Pair';
  }
}

async function copyText(text, buttonEl, defaultLabel = 'Copy') {
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.textContent = 'Copied!';
    buttonEl.classList.add('copied');
    setTimeout(() => {
      buttonEl.textContent = defaultLabel;
      buttonEl.classList.remove('copied');
    }, 2000);
  } catch (_) {
    alert('Failed to copy to clipboard.');
  }
}

document.getElementById('btnToggleToken')?.addEventListener('click', (e) => {
  if (!myInstance) return;
  isTokenRevealed = !isTokenRevealed;
  document.getElementById('docAccessToken').textContent = isTokenRevealed ? myInstance.accessToken : '••••••••••••••••••••';
  e.target.textContent = isTokenRevealed ? 'Hide' : 'Show';
});

document.getElementById('btnCopyDocInstanceId')?.addEventListener('click', (e) => {
  if (myInstance?.id) copyText(myInstance.id, e.target);
});

document.getElementById('btnCopyDocToken')?.addEventListener('click', (e) => {
  if (myInstance?.accessToken) copyText(myInstance.accessToken, e.target);
});

document.getElementById('btnCopyDocBaseUrl')?.addEventListener('click', (e) => {
  copyText(window.location.origin, e.target);
});

document.getElementById('btnCopyLiveUrl')?.addEventListener('click', (e) => {
  const code = document.getElementById('docLiveUrl')?.textContent;
  if (code) copyText(code, e.target, '📋 Copy Full URL');
});

document.getElementById('btnCopySnippet')?.addEventListener('click', (e) => {
  const code = document.getElementById('docSnippetCode')?.textContent;
  if (code) copyText(code, e.target, 'Copy Code');
});

document.getElementById('docCodeTabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-tab-btn');
  if (!btn) return;
  document.querySelectorAll('.lang-tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderSnippet(btn.dataset.lang);
});

(async () => {
  try {
    const response = await api('/api/user-auth/me');
    if (response.ok) {
      const data = await response.safeJson();
      if (data && data.data) openDashboard(data.data);
    }
  } catch (_) {}
})();
