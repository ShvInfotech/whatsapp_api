const auth = document.getElementById('userAuth');
const dashboard = document.getElementById('userDashboard');
const loginForm = document.getElementById('userLoginForm');
const registerForm = document.getElementById('userRegisterForm');
const userAuthError = document.getElementById('userAuthError');
const registerError = document.getElementById('registerError');
let myInstance;
let pollTimer;
const userTabs = document.querySelectorAll('[data-user-tab]');
userTabs.forEach((tab) => tab.addEventListener('click', () => {
  userTabs.forEach((item) => item.classList.remove('active'));
  document.querySelectorAll('.user-tab-panel').forEach((panel) => panel.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById(tab.dataset.userTab)?.classList.add('active');
}));

async function api(endpoint, options) { return fetch(endpoint, { credentials: 'include', ...options }); }
function showError(element, message) { element.textContent = message; element.classList.remove('hidden'); }
function showLogin() { loginForm.classList.remove('hidden'); registerForm.classList.add('hidden'); }
function showRegister() { registerForm.classList.remove('hidden'); loginForm.classList.add('hidden'); }

document.getElementById('showRegister').addEventListener('click', showRegister);
document.getElementById('showUserLogin').addEventListener('click', showLogin);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); userAuthError.classList.add('hidden');
  const response = await api('/api/user-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userLoginUsername.value, password: userLoginPassword.value }) });
  const data = await response.json();
  if (!response.ok) return showError(userAuthError, data.error || 'Login failed.');
  openDashboard(data.data);
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault(); registerError.classList.add('hidden');
  const response = await api('/api/user-auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: registerFullName.value, username: registerUsername.value, email: registerEmail.value, password: registerPassword.value }) });
  const data = await response.json();
  if (!response.ok) return showError(registerError, data.error || 'Registration failed.');
  showLogin(); userLoginUsername.value = registerUsername.value; userLoginPassword.value = ''; showError(userAuthError, 'Registration complete. Please login.');
});

async function openDashboard(user) {
  auth.classList.add('hidden'); dashboard.classList.remove('hidden');
  document.getElementById('welcomeUser').textContent = `Signed in as ${user.fullName} (@${user.username})`;
  const response = await api('/api/user/instances'); const data = await response.json();
  if (!response.ok || !data.data.length) {
    document.getElementById('instanceStatus').textContent = data.error || 'Your WhatsApp instance is unavailable.';
    document.getElementById('userNavStatus').textContent = 'Instance unavailable';
    return;
  }
  myInstance = data.data[0]; document.getElementById('instanceName').textContent = myInstance.name;
  refreshQr();
}

async function refreshQr() {
  if (!myInstance) return;
  try {
    const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/qr`); const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const info = data.data; document.getElementById('instanceStatus').textContent = `Status: ${info.status}`;
    document.getElementById('userNavStatus').textContent = info.isConnected ? 'WhatsApp Connected' : (info.qrReady ? 'Scan QR to Connect' : 'Preparing WhatsApp');
    const image = document.getElementById('userQrImage'); const loader = document.getElementById('userQrLoader'); const connected = document.getElementById('connectedInfo');
    document.getElementById('copyUserAppLink').classList.toggle('hidden', !info.isConnected);
    if (info.isConnected) { image.classList.add('hidden'); loader.classList.add('hidden'); connected.textContent = `✓ Connected as ${info.pushname || 'WhatsApp user'} ${info.phone ? `(+${info.phone})` : ''}`; connected.classList.remove('hidden'); }
    else if (info.qrDataUrl) { image.src = info.qrDataUrl; image.classList.remove('hidden'); loader.classList.add('hidden'); connected.classList.add('hidden'); }
    else { image.classList.add('hidden'); loader.classList.remove('hidden'); connected.classList.add('hidden'); }
  } catch (error) { document.getElementById('instanceStatus').textContent = error.message || 'Unable to load your QR code.'; document.getElementById('copyUserAppLink').classList.add('hidden'); }
  pollTimer = setTimeout(refreshQr, 2500);
}

document.getElementById('resetMySession').addEventListener('click', async () => { if (!myInstance || !confirm('Reset your WhatsApp session?')) return; await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/reset`, { method: 'POST' }); refreshQr(); });
document.getElementById('userLogout').addEventListener('click', async () => { clearTimeout(pollTimer); await api('/api/user-auth/logout', { method: 'POST' }); location.reload(); });
document.getElementById('copyUserAppLink').addEventListener('click', async () => {
  if (!myInstance?.id || !myInstance?.accessToken) return;
  const link = `${window.location.origin}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(myInstance.id)}&access_token=${encodeURIComponent(myInstance.accessToken)}`;
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

document.getElementById('userSingleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('userSendSingle');
  button.disabled = true;
  try {
    const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: document.getElementById('userSinglePhone').value.trim(), message: document.getElementById('userSingleMessage').value.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
    setResult('userSingleResult', 'Message sent successfully.');
    event.target.reset();
  } catch (error) { setResult('userSingleResult', error.message, true); }
  finally { button.disabled = false; }
});

const userBulkNumbers = document.getElementById('userBulkNumbers');
const userBulkMessage = document.getElementById('userBulkMessage');
const userDelayRange = document.getElementById('userDelayRange');

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
document.getElementById('userClearNumbers').addEventListener('click', () => { userBulkNumbers.value = ''; updateUserBulkCounts(); });
document.getElementById('userClearLog').addEventListener('click', () => { document.getElementById('userLogTableBody').innerHTML = '<tr class="empty-row"><td colspan="4">Log cleared. Ready for next dispatch.</td></tr>'; });
document.querySelectorAll('[data-user-fmt]').forEach((button) => button.addEventListener('click', () => {
  const marks = { bold: '*', italic: '_', strike: '~', mono: '```' }; const mark = marks[button.dataset.userFmt];
  const start = userBulkMessage.selectionStart; const end = userBulkMessage.selectionEnd; const selected = userBulkMessage.value.slice(start, end) || 'text';
  userBulkMessage.setRangeText(`${mark}${selected}${mark}`, start, end, 'end'); userBulkMessage.focus(); updateUserBulkCounts();
}));

document.getElementById('userBulkForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('userSendBulk'); const phoneNumbers = parseUserNumbers(); const message = userBulkMessage.value.trim();
  if (!phoneNumbers.length || !message) return setResult('userBulkResult', 'Add at least one valid number and a message.', true);
  button.disabled = true; const state = document.getElementById('userExecStateBadge'); state.className = 'badge badge-running'; state.textContent = 'Sending...';
  updateUserBulkProgress(0, phoneNumbers.length, 0, 0); document.getElementById('userLogTableBody').innerHTML = phoneNumbers.map((number, index) => `<tr><td>${index + 1}</td><td>${number}</td><td class="text-muted">Queued</td><td>-</td></tr>`).join('');
  try {
    const delayMs = Number(userDelayRange.value) * 1000;
    const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumbers, message, options: { minDelayMs: Math.max(1000, delayMs - 500), maxDelayMs: delayMs + 500 } }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Bulk messages could not be sent.');
    const results = data.data?.results || []; let sent = 0; let failed = 0;
    document.getElementById('userLogTableBody').innerHTML = results.map((result, index) => { const ok = result.status === 'sent'; if (ok) sent += 1; else failed += 1; return `<tr><td>${index + 1}</td><td>${result.phoneNumber}</td><td class="${ok ? 'status-sent' : 'status-failed'}">${ok ? 'Sent' : 'Failed'}</td><td>${ok ? 'Delivered to WhatsApp' : (result.error || 'Could not send')}</td></tr>`; }).join('');
    updateUserBulkProgress(results.length, phoneNumbers.length, sent, failed); state.className = 'badge badge-completed'; state.textContent = 'Completed'; setResult('userBulkResult', data.message || 'Bulk sending completed.');
  } catch (error) { state.className = 'badge badge-stopped'; state.textContent = 'Failed'; setResult('userBulkResult', error.message, true); }
  finally { button.disabled = false; }
});

updateUserBulkCounts();
updateUserDelay();

(async () => { const response = await api('/api/user-auth/me'); if (response.ok) openDashboard((await response.json()).data); })();
