/**
 * Safe Vault WhatsApp Automation Console - Frontend Client
 */

// State
let clientStatus = 'DISCONNECTED';
let isSendingBulk = false;
let shouldStopBulk = false;
let parsedNumbers = [];
let previousConnected = null;
let statusPollingTimer = null;

// Detect base URL dynamically for subpaths (e.g. /whatsapp_api/) or root deployments
const getApiBaseUrl = () => {
  if (window.API_BASE_URL !== undefined) return window.API_BASE_URL;
  const path = window.location.pathname.replace(/\/(index\.(php|html)|dashboard)?\/?$/, '');
  return path || '';
};
const API_BASE_URL = getApiBaseUrl();

function apiFetch(endpoint, options) {
  return fetch(`${API_BASE_URL}${endpoint}`, { credentials: 'include', ...options });
}

const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginButton = document.getElementById('loginButton');
const btnAdminLogout = document.getElementById('btnAdminLogout');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const showForgotPassword = document.getElementById('showForgotPassword');
const showLogin = document.getElementById('showLogin');
const recoveryUsername = document.getElementById('recoveryUsername');
const recoveryEmail = document.getElementById('recoveryEmail');
const recoveryCode = document.getElementById('recoveryCode');
const newPassword = document.getElementById('newPassword');
const recoveryError = document.getElementById('recoveryError');
const resetPasswordButton = document.getElementById('resetPasswordButton');

// DOM Elements
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const deviceBadge = document.getElementById('deviceBadge');
const deviceName = document.getElementById('deviceName');
const devicePhone = document.getElementById('devicePhone');

// QR Hero Banner & Connected Banner on index.html
const qrHeroBanner = document.getElementById('qrHeroBanner');
const heroBadgeText = document.getElementById('heroBadgeText');
const heroTitle = document.getElementById('heroTitle');
const heroStatusNotice = document.getElementById('heroStatusNotice');
const heroNoticeText = document.getElementById('heroNoticeText');
const heroQrLoader = document.getElementById('heroQrLoader');
const heroLoaderText = document.getElementById('heroLoaderText');
const heroQrImage = document.getElementById('heroQrImage');
const connectedBanner = document.getElementById('connectedBanner');
const connDeviceInfo = document.getElementById('connDeviceInfo');
const btnBannerReset = document.getElementById('btnBannerReset');

const bulkNumbersInput = document.getElementById('bulkNumbers');
const bulkMessageInput = document.getElementById('bulkMessage');
const numberCountBadge = document.getElementById('numberCountBadge');
const charCountBadge = document.getElementById('charCountBadge');
const delayRange = document.getElementById('delayRange');
const sliderVal = document.getElementById('sliderVal');
const delayDisplay = document.getElementById('delayDisplay');

const btnStartBulk = document.getElementById('btnStartBulk');
const btnStopBulk = document.getElementById('btnStopBulk');
const btnSampleNumbers = document.getElementById('btnSampleNumbers');
const btnClearNumbers = document.getElementById('btnClearNumbers');

const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressSummary = document.getElementById('progressSummary');
const countdownBanner = document.getElementById('countdownBanner');
const countdownText = document.getElementById('countdownText');
const execStateBadge = document.getElementById('execStateBadge');

const statTotal = document.getElementById('statTotal');
const statSent = document.getElementById('statSent');
const statFailed = document.getElementById('statFailed');
const statRemaining = document.getElementById('statRemaining');
const logTableBody = document.getElementById('logTableBody');
const btnClearLog = document.getElementById('btnClearLog');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Device Tab Elements
const detailStatus = document.getElementById('detailStatus');
const detailName = document.getElementById('detailName');
const detailPhone = document.getElementById('detailPhone');
const detailPlatform = document.getElementById('detailPlatform');
const detailTime = document.getElementById('detailTime');
const qrBox = document.getElementById('qrBox');
const qrImage = document.getElementById('qrImage');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const qrNotice = document.getElementById('qrNotice');
const btnRefreshStatus = document.getElementById('btnRefreshStatus');
const btnResetSession = document.getElementById('btnResetSession');

// Single Send Tab Elements
const singleForm = document.getElementById('singleForm');
const singlePhone = document.getElementById('singlePhone');
const singleMessage = document.getElementById('singleMessage');
const btnSendSingle = document.getElementById('btnSendSingle');
const singleResultBox = document.getElementById('singleResultBox');

const toast = document.getElementById('toast');

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  const loggedIn = await restoreAdminSession();
  if (!loggedIn) return;
  startDashboard();
});

function startDashboard() {
  setupTabs();
  setupInputs();
  setupDelaySlider();
  setupFormattingButtons();
  setupSingleSender();
  setupDeviceActions();
  setupInstanceManagement();

  // Initial status check & adaptive polling
  fetchStatus();
  fetchInstances();
}

async function restoreAdminSession() {
  try {
    const response = await apiFetch('/api/auth/me');
    if (!response.ok) return false;
    document.body.classList.remove('auth-required');
    loginScreen.classList.add('hidden');
    return true;
  } catch (_) {
    return false;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.classList.add('hidden');
    loginButton.disabled = true;
    loginButton.textContent = 'Checking...';
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.value.trim(), password: loginPassword.value })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Login failed.');
      document.body.classList.remove('auth-required');
      loginScreen.classList.add('hidden');
      startDashboard();
    } catch (error) {
      loginError.textContent = error.message;
      loginError.classList.remove('hidden');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Login as Admin';
    }
  });
}

function toggleRecoveryForm(showRecovery) {
  loginForm.classList.toggle('hidden', showRecovery);
  forgotPasswordForm.classList.toggle('hidden', !showRecovery);
}

if (showForgotPassword) showForgotPassword.addEventListener('click', () => toggleRecoveryForm(true));
if (showLogin) showLogin.addEventListener('click', () => toggleRecoveryForm(false));

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    recoveryError.classList.add('hidden');
    resetPasswordButton.disabled = true;
    resetPasswordButton.textContent = 'Updating...';
    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.value.trim(), email: recoveryEmail.value.trim(),
          recoveryCode: recoveryCode.value, newPassword: newPassword.value
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Password reset failed.');
      loginError.textContent = data.message;
      loginError.classList.remove('hidden');
      loginPassword.value = '';
      forgotPasswordForm.reset();
      toggleRecoveryForm(false);
    } catch (error) {
      recoveryError.textContent = error.message;
      recoveryError.classList.remove('hidden');
    } finally {
      resetPasswordButton.disabled = false;
      resetPasswordButton.textContent = 'Update Password';
    }
  });
}

if (btnAdminLogout) {
  btnAdminLogout.addEventListener('click', async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    if (statusPollingTimer) clearTimeout(statusPollingTimer);
    window.location.reload();
  });
}

// ==========================================================================
// Tab Switching
// ==========================================================================
function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTabId = button.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      button.classList.add('active');
      const targetPanel = document.getElementById(targetTabId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      if (targetTabId === 'deviceTab') {
        fetchQrCode();
      }
    });
  });
}

// ==========================================================================
// Status Polling & Rendering
// ==========================================================================
async function fetchStatus() {
  try {
    const res = await apiFetch('/api/status');
    const data = await res.json();

    if (!data.success) return;

    const info = data.data;
    clientStatus = info.status;

    // Fast polling if waiting for scan/auth, standard if connected
    const nextInterval = info.isConnected ? 4000 : 1500;
    if (statusPollingTimer) clearTimeout(statusPollingTimer);
    statusPollingTimer = setTimeout(fetchStatus, nextInterval);

    // Update Header Status Pill
    statusPill.className = 'status-pill';
    if (info.isConnected) {
      statusPill.classList.add('status-connected');
      statusText.textContent = 'WhatsApp Connected';

      if (info.clientInfo) {
        deviceBadge.classList.remove('hidden');
        deviceName.textContent = info.clientInfo.pushname || 'Safe Vault User';
        devicePhone.textContent = `(${info.clientInfo.phone || ''})`;
      }

      // Hide QR Hero Banner and show Connected Banner on index.html
      if (qrHeroBanner) qrHeroBanner.classList.add('hidden');
      if (connectedBanner) {
        connectedBanner.classList.remove('hidden');
        if (connDeviceInfo) {
          connDeviceInfo.textContent = `Connected as: ${info.clientInfo?.pushname || 'Safe Vault User'} (+${info.clientInfo?.phone || 'Unknown'}) • Platform: ${info.clientInfo?.platform || 'WhatsApp Web'}`;
        }
      }

      // If just transitioned to connected, notify user
      if (previousConnected === false) {
        showToast(`🎉 WhatsApp successfully connected as ${info.clientInfo?.pushname || 'User'}!`, 'success');
      }
      previousConnected = true;

    } else if (info.status === 'AUTHENTICATING') {
      previousConnected = false;
      statusPill.classList.add('status-loading');
      statusText.textContent = 'Logging In...';
      deviceBadge.classList.add('hidden');

      if (qrHeroBanner) qrHeroBanner.classList.remove('hidden');
      if (connectedBanner) connectedBanner.classList.add('hidden');

      if (heroQrLoader) {
        heroQrLoader.classList.remove('hidden');
        if (heroLoaderText) heroLoaderText.textContent = 'Authenticating & Syncing session...';
      }
      if (heroQrImage) heroQrImage.classList.add('hidden');
      if (heroBadgeText) heroBadgeText.textContent = 'Logging In...';
      if (heroNoticeText) heroNoticeText.textContent = '✓ QR Code scanned! Syncing session with your phone...';

    } else if (info.status === 'QR_READY') {
      previousConnected = false;
      statusPill.classList.add('status-loading');
      statusText.textContent = 'Scan QR Code';
      deviceBadge.classList.add('hidden');

      if (qrHeroBanner) qrHeroBanner.classList.remove('hidden');
      if (connectedBanner) connectedBanner.classList.add('hidden');

      if (info.qrDataUrl) {
        if (heroQrImage) {
          heroQrImage.src = info.qrDataUrl;
          heroQrImage.classList.remove('hidden');
        }
        if (heroQrLoader) heroQrLoader.classList.add('hidden');
        if (heroBadgeText) heroBadgeText.textContent = 'Scan QR Code to Login';
        if (heroNoticeText) heroNoticeText.textContent = 'Waiting for scan... (Authentication will sync automatically once scanned)';

        // Also sync QR in deviceTab
        if (qrImage) {
          qrImage.src = info.qrDataUrl;
          qrImage.classList.remove('hidden');
        }
        if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
      } else {
        if (heroQrLoader) {
          heroQrLoader.classList.remove('hidden');
          if (heroLoaderText) heroLoaderText.textContent = 'Loading QR Code...';
        }
        if (heroQrImage) heroQrImage.classList.add('hidden');
      }

    } else {
      previousConnected = false;
      statusPill.classList.add('status-disconnected');
      statusText.textContent = 'Disconnected';
      deviceBadge.classList.add('hidden');

      if (qrHeroBanner) qrHeroBanner.classList.remove('hidden');
      if (connectedBanner) connectedBanner.classList.add('hidden');

      if (heroQrLoader) {
        heroQrLoader.classList.remove('hidden');
        if (heroLoaderText) heroLoaderText.textContent = 'Starting WhatsApp Engine...';
      }
      if (heroQrImage) heroQrImage.classList.add('hidden');
      if (heroNoticeText) heroNoticeText.textContent = 'Starting WhatsApp Engine. Pairing QR code will appear shortly...';
    }

    // Update Device Tab Details
    if (detailStatus) {
      detailStatus.textContent = info.status;
      detailStatus.className = 'detail-val badge';
      if (info.isConnected) {
        detailStatus.classList.add('badge-completed');
      } else {
        detailStatus.classList.add('badge-idle');
      }

      detailName.textContent = info.clientInfo?.pushname || '-';
      detailPhone.textContent = info.clientInfo?.phone ? `+${info.clientInfo.phone}` : '-';
      detailPlatform.textContent = info.clientInfo?.platform || '-';
      detailTime.textContent = info.lastConnectedAt ? new Date(info.lastConnectedAt).toLocaleString() : '-';

      const defaultIdElem = document.getElementById('defaultInstanceId');
      const defaultTokenElem = document.getElementById('defaultAccessToken');
      if (defaultIdElem && info.instanceId) defaultIdElem.textContent = info.instanceId;
      if (defaultTokenElem && info.accessToken) defaultTokenElem.textContent = info.accessToken;
    }

    // Device Tab QR update
    if (info.isConnected) {
      if (qrImage) qrImage.classList.add('hidden');
      if (qrPlaceholder) {
        qrPlaceholder.classList.remove('hidden');
        qrNotice.textContent = `✓ WhatsApp is connected to +${info.clientInfo?.phone || ''}`;
      }
    }

  } catch (err) {
    statusPill.className = 'status-pill status-disconnected';
    statusText.textContent = 'Server Offline';
    if (statusPollingTimer) clearTimeout(statusPollingTimer);
    statusPollingTimer = setTimeout(fetchStatus, 3000);
  }
}

async function fetchQrCode() {
  try {
    const res = await apiFetch('/api/qr?format=json', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();

    if (data.status === 'CONNECTED') {
      if (qrImage) qrImage.classList.add('hidden');
      if (qrPlaceholder) {
        qrPlaceholder.classList.remove('hidden');
        qrNotice.textContent = '✓ WhatsApp is connected and ready.';
      }
    } else if (data.status === 'AUTHENTICATING') {
      if (qrImage) qrImage.classList.add('hidden');
      if (qrPlaceholder) {
        qrPlaceholder.classList.remove('hidden');
        qrNotice.textContent = 'Restoring saved session from phone...';
      }
    } else if (data.qrDataUrl) {
      if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
      if (qrImage) {
        qrImage.src = data.qrDataUrl;
        qrImage.classList.remove('hidden');
      }
    } else {
      if (qrImage) qrImage.classList.add('hidden');
      if (qrPlaceholder) {
        qrPlaceholder.classList.remove('hidden');
        qrNotice.textContent = 'Initializing WhatsApp engine...';
      }
    }
  } catch (e) {}
}

// ==========================================================================
// Phone Number Parsing & Input Handling
// ==========================================================================
function parsePhoneNumbers(rawText) {
  if (!rawText) return [];

  // Split by newlines, commas, semicolons, or tabs
  const tokens = rawText.split(/[\n,;\t]+/);
  const result = [];
  const seen = new Set();

  for (let token of tokens) {
    // Strip all non-digit characters
    let cleaned = token.replace(/\D/g, '');
    if (!cleaned) continue;

    // Remove leading zeros
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

    // If Indian 10-digit mobile number, prepend 91
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      cleaned = '91' + cleaned;
    }

    // Must be valid international format (10 to 15 digits)
    if (cleaned.length >= 10 && cleaned.length <= 15 && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }

  return result;
}

function setupInputs() {
  bulkNumbersInput.addEventListener('input', () => {
    parsedNumbers = parsePhoneNumbers(bulkNumbersInput.value);
    numberCountBadge.textContent = `${parsedNumbers.length} Number${parsedNumbers.length === 1 ? '' : 's'}`;
  });

  bulkMessageInput.addEventListener('input', () => {
    charCountBadge.textContent = `${bulkMessageInput.value.length} Chars`;
  });

  btnSampleNumbers.addEventListener('click', () => {
    bulkNumbersInput.value = '918140349408\n919727899812';
    parsedNumbers = parsePhoneNumbers(bulkNumbersInput.value);
    numberCountBadge.textContent = `${parsedNumbers.length} Numbers`;
    showToast('Loaded 2 test numbers: 918140349408 & 919727899812', 'success');
  });

  btnClearNumbers.addEventListener('click', () => {
    bulkNumbersInput.value = '';
    parsedNumbers = [];
    numberCountBadge.textContent = '0 Numbers';
  });

  btnClearLog.addEventListener('click', () => {
    logTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">Log cleared. Ready for next dispatch.</td>
      </tr>
    `;
    resetStats();
  });
}

function setupDelaySlider() {
  delayRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sliderVal.textContent = `${val}s`;
    delayDisplay.textContent = `${Math.max(1, Math.floor(val - 0.5))} - ${Math.ceil(val + 0.5)} Seconds`;
  });
}

function setupFormattingButtons() {
  document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textarea = bulkMessageInput;
      const fmt = btn.getAttribute('data-fmt');
      const emoji = btn.getAttribute('data-emoji');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const sel = textarea.value.substring(start, end);

      let insert = '';
      if (emoji) {
        insert = emoji;
      } else if (fmt === 'bold') {
        insert = `*${sel || 'bold text'}*`;
      } else if (fmt === 'italic') {
        insert = `_${sel || 'italic text'}_`;
      } else if (fmt === 'strike') {
        insert = `~${sel || 'strike text'}~`;
      } else if (fmt === 'mono') {
        insert = `\`\`\`${sel || 'code text'}\`\`\``;
      }

      textarea.setRangeText(insert, start, end, 'end');
      textarea.focus();
      charCountBadge.textContent = `${textarea.value.length} Chars`;
    });
  });
}

// ==========================================================================
// Bulk Message Sending Engine (Sequential with 4-5s Anti-Ban Delay)
// ==========================================================================
btnStartBulk.addEventListener('click', async () => {
  if (isSendingBulk) return;

  parsedNumbers = parsePhoneNumbers(bulkNumbersInput.value);
  const message = bulkMessageInput.value.trim();

  if (parsedNumbers.length === 0) {
    showToast('Please enter at least one valid phone number.', 'error');
    bulkNumbersInput.focus();
    return;
  }

  if (!message) {
    showToast('Please enter the message text.', 'error');
    bulkMessageInput.focus();
    return;
  }

  if (clientStatus !== 'CONNECTED') {
    showToast(`WhatsApp is not connected (Current: ${clientStatus}). Please check QR code.`, 'error');
    return;
  }

  // Start Bulk Dispatch
  isSendingBulk = true;
  shouldStopBulk = false;

  btnStartBulk.classList.add('hidden');
  btnStopBulk.classList.remove('hidden');
  execStateBadge.className = 'badge badge-running';
  execStateBadge.textContent = 'Sending...';

  const total = parsedNumbers.length;
  let sentCount = 0;
  let failedCount = 0;

  statTotal.textContent = total;
  statSent.textContent = '0';
  statFailed.textContent = '0';
  statRemaining.textContent = total;
  updateProgress(0, total);

  // Initialize table rows
  logTableBody.innerHTML = '';
  parsedNumbers.forEach((num, index) => {
    const row = document.createElement('tr');
    row.id = `row-${index}`;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>+${num}</strong></td>
      <td><span class="tag-pending">Pending</span></td>
      <td>-</td>
      <td class="text-muted">Queued</td>
    `;
    logTableBody.appendChild(row);
  });

  const baseDelaySec = parseFloat(delayRange.value) || 4.5;

  for (let i = 0; i < total; i++) {
    if (shouldStopBulk) {
      showToast('Bulk messaging stopped by user.', 'error');
      break;
    }

    const phone = parsedNumbers[i];
    const row = document.getElementById(`row-${i}`);
    if (row) {
      row.children[2].innerHTML = '<span class="tag-sending">Sending...</span>';
    }

    const timeStr = new Date().toLocaleTimeString();

    try {
      let response;
      const bulkInstanceSelect = document.getElementById('bulkInstanceSelect');
      const selectedInstanceId = bulkInstanceSelect ? bulkInstanceSelect.value : null;

      if (selectedInstanceId) {
        const selOpt = bulkInstanceSelect.options[bulkInstanceSelect.selectedIndex];
        const token = selOpt ? selOpt.dataset.token : '';
        response = await apiFetch(`/api/send?number=${encodeURIComponent(phone)}&type=text&message=${encodeURIComponent(message)}&instance_id=${encodeURIComponent(selectedInstanceId)}&access_token=${encodeURIComponent(token)}`);
      } else {
        response = await apiFetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phone,
            message: message
          })
        });
      }

      const resData = await response.json();
      const isSuccess = response.ok && (resData.success || resData.status === 'success');

      if (isSuccess) {
        sentCount++;
        statSent.textContent = sentCount;
        if (row) {
          row.children[2].innerHTML = '<span class="tag-sent">✓ Sent</span>';
          row.children[3].textContent = timeStr;
          row.children[4].textContent = 'Delivered';
        }
      } else {
        failedCount++;
        statFailed.textContent = failedCount;
        if (row) {
          row.children[2].innerHTML = '<span class="tag-failed">✕ Failed</span>';
          row.children[3].textContent = timeStr;
          row.children[4].textContent = resData.message || resData.error || 'Failed to send';
        }
      }
    } catch (sendErr) {
      failedCount++;
      statFailed.textContent = failedCount;
      if (row) {
        row.children[2].innerHTML = '<span class="tag-failed">✕ Error</span>';
        row.children[3].textContent = timeStr;
        row.children[4].textContent = sendErr.message;
      }
    }

    statRemaining.textContent = total - (i + 1);
    updateProgress(i + 1, total);

    // If more messages remaining, apply randomized 4 to 5 second delay
    if (i < total - 1 && !shouldStopBulk) {
      // Apply jitter: e.g. 4.5s +/- 0.6s -> 3.9s to 5.1s
      const jitterMs = (baseDelaySec * 1000) + (Math.random() * 1200 - 600);
      await runCountdown(Math.round(jitterMs / 100) / 10);
    }
  }

  // Finished
  countdownBanner.classList.add('hidden');
  isSendingBulk = false;
  btnStartBulk.classList.remove('hidden');
  btnStopBulk.classList.add('hidden');

  if (shouldStopBulk) {
    execStateBadge.className = 'badge badge-stopped';
    execStateBadge.textContent = 'Stopped';
  } else {
    execStateBadge.className = 'badge badge-completed';
    execStateBadge.textContent = 'Finished';
    showToast(`Bulk dispatch completed: ${sentCount}/${total} delivered successfully!`, 'success');
  }
});

btnStopBulk.addEventListener('click', () => {
  if (isSendingBulk) {
    shouldStopBulk = true;
    btnStopBulk.textContent = 'Stopping...';
  }
});

function updateProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressSummary.textContent = `${current} of ${total} Completed`;
}

async function runCountdown(totalSeconds) {
  countdownBanner.classList.remove('hidden');
  let remaining = totalSeconds;

  while (remaining > 0 && !shouldStopBulk) {
    countdownText.textContent = `Waiting ${remaining.toFixed(1)}s (Anti-Ban safety delay before next message)...`;
    await new Promise(r => setTimeout(r, 200));
    remaining -= 0.2;
  }

  countdownBanner.classList.add('hidden');
}

function resetStats() {
  statTotal.textContent = '0';
  statSent.textContent = '0';
  statFailed.textContent = '0';
  statRemaining.textContent = '0';
  updateProgress(0, 0);
  execStateBadge.className = 'badge badge-idle';
  execStateBadge.textContent = 'Ready';
}

// ==========================================================================
// Single Message Sender
// ==========================================================================
function setupSingleSender() {
  singleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone = singlePhone.value.trim();
    const msg = singleMessage.value.trim();

    if (!phone || !msg) {
      showToast('Please enter both phone number and message.', 'error');
      return;
    }

    btnSendSingle.disabled = true;
    btnSendSingle.textContent = 'Sending WhatsApp message...';
    singleResultBox.classList.add('hidden');

    try {
      let res;
      const singleInstanceSelect = document.getElementById('singleInstanceSelect');
      const selectedInstanceId = singleInstanceSelect ? singleInstanceSelect.value : null;

      if (selectedInstanceId) {
        const selOpt = singleInstanceSelect.options[singleInstanceSelect.selectedIndex];
        const token = selOpt ? selOpt.dataset.token : '';
        res = await apiFetch(`/api/send?number=${encodeURIComponent(phone)}&type=text&message=${encodeURIComponent(msg)}&instance_id=${encodeURIComponent(selectedInstanceId)}&access_token=${encodeURIComponent(token)}`);
      } else {
        res = await apiFetch('/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phone, message: msg })
        });
      }

      const data = await res.json();
      singleResultBox.classList.remove('hidden');

      const isSuccess = res.ok && (data.success || data.status === 'success');

      if (isSuccess) {
        singleResultBox.className = 'result-box result-success';
        singleResultBox.innerHTML = `
          <strong>✓ Message Sent Successfully!</strong>
          <p>Recipient: +${data.data?.to || data.data?.recipient || phone}</p>
          <p>Message ID: <code>${data.data?.id || data.data?.messageId || 'Delivered'}</code></p>
        `;
        showToast('Message delivered successfully!', 'success');
      } else {
        singleResultBox.className = 'result-box result-error';
        singleResultBox.innerHTML = `
          <strong>✕ Failed to Send</strong>
          <p>${data.message || data.error || 'Unknown error'}</p>
        `;
        showToast(data.message || data.error || 'Failed to send message', 'error');
      }
    } catch (err) {
      singleResultBox.className = 'result-box result-error';
      singleResultBox.textContent = `Network Error: ${err.message}`;
    } finally {
      btnSendSingle.disabled = false;
      btnSendSingle.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Send WhatsApp Message
      `;
    }
  });
}

// ==========================================================================
// Device & QR Actions
// ==========================================================================
function setupDeviceActions() {
  if (statusPill) {
    statusPill.style.cursor = 'pointer';
    statusPill.title = 'Click to view status / QR Code';
    statusPill.addEventListener('click', () => {
      if (clientStatus !== 'CONNECTED') {
        if (qrHeroBanner) {
          qrHeroBanner.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  if (btnRefreshStatus) {
    btnRefreshStatus.addEventListener('click', () => {
      fetchStatus();
      fetchQrCode();
      showToast('Status refreshed', 'success');
    });
  }

  if (btnBannerReset) {
    btnBannerReset.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to log out / change your WhatsApp number?')) {
        return;
      }

      btnBannerReset.disabled = true;
      btnBannerReset.textContent = 'Logging out...';

      // Instant UI feedback
      clientStatus = 'INITIALIZING';
      if (qrHeroBanner) qrHeroBanner.classList.remove('hidden');
      if (connectedBanner) connectedBanner.classList.add('hidden');
      if (heroQrLoader) {
        heroQrLoader.classList.remove('hidden');
        if (heroLoaderText) heroLoaderText.textContent = 'Logging out WhatsApp and generating fresh QR code...';
      }
      if (heroQrImage) heroQrImage.classList.add('hidden');

      try {
        const res = await apiFetch('/api/reset-session', {
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        showToast(data.message || 'Logged out. Fresh QR code is loading...', 'success');
        fetchStatus();
      } catch (e) {
        showToast('Error logging out: ' + e.message, 'error');
      } finally {
        btnBannerReset.disabled = false;
        btnBannerReset.textContent = 'Logout / Change Number';
      }
    });
  }

  btnResetSession.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear your WhatsApp session and pair again with a fresh QR code?')) {
      return;
    }

    btnResetSession.disabled = true;
    btnResetSession.textContent = 'Resetting Session...';

    // Instant UI feedback
    clientStatus = 'INITIALIZING';
    if (qrHeroBanner) qrHeroBanner.classList.remove('hidden');
    if (connectedBanner) connectedBanner.classList.add('hidden');
    if (heroQrLoader) {
      heroQrLoader.classList.remove('hidden');
      if (heroLoaderText) heroLoaderText.textContent = 'Logging out WhatsApp and generating fresh QR code...';
    }
    if (heroQrImage) heroQrImage.classList.add('hidden');

    try {
      const res = await apiFetch('/api/reset-session', {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      showToast(data.message || 'Session reset. Loading fresh QR code...', 'success');
      fetchStatus();
    } catch (e) {
      showToast('Error resetting session: ' + e.message, 'error');
    } finally {
      btnResetSession.disabled = false;
      btnResetSession.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Reset Session (Clear & Scan New QR)
      `;
    }
  });
}

// ==========================================================================
// Toast Notification
// ==========================================================================
let toastTimer = null;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ==========================================================================
// Multi-Instance Management
// ==========================================================================
let instancesCache = [];
let activeQrPollingId = null;
let qrPollingTimer = null;

function setupInstanceManagement() {
  const btnOpenCreateInstance = document.getElementById('btnOpenCreateInstance');
  const createInstanceModal = document.getElementById('createInstanceModal');
  const btnCloseCreateModal = document.getElementById('btnCloseCreateModal');
  const btnCancelCreateModal = document.getElementById('btnCancelCreateModal');
  const createInstanceForm = document.getElementById('createInstanceForm');
  const instanceNameInput = document.getElementById('instanceNameInput');

  const instanceQrModal = document.getElementById('instanceQrModal');
  const btnCloseQrModal = document.getElementById('btnCloseQrModal');
  const btnCopyPublicScanLink = document.getElementById('btnCopyPublicScanLink');

  if (btnOpenCreateInstance) {
    btnOpenCreateInstance.addEventListener('click', () => {
      createInstanceModal.classList.remove('hidden');
      instanceNameInput.value = '';
      instanceNameInput.focus();
    });
  }

  const closeCreate = () => createInstanceModal.classList.add('hidden');
  if (btnCloseCreateModal) btnCloseCreateModal.addEventListener('click', closeCreate);
  if (btnCancelCreateModal) btnCancelCreateModal.addEventListener('click', closeCreate);

  if (createInstanceForm) {
    createInstanceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = instanceNameInput.value.trim();
      if (!name) return;

      const submitBtn = document.getElementById('btnSubmitCreateInstance');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        const res = await apiFetch('/api/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Instance '${name}' created!`, 'success');
          closeCreate();
          await fetchInstances();
          if (data.data && data.data.id) {
            openInstanceQrModal(data.data.id, data.data.name);
          }
        } else {
          showToast(data.error || 'Failed to create instance', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create & Generate Token';
      }
    });
  }

  const closeQr = () => {
    clearInterval(qrPollingTimer);
    activeQrPollingId = null;
    instanceQrModal.classList.add('hidden');
    fetchInstances();
  };
  if (btnCloseQrModal) btnCloseQrModal.addEventListener('click', closeQr);

  if (btnCopyPublicScanLink) {
    btnCopyPublicScanLink.addEventListener('click', () => {
      if (!activeQrPollingId) return;
      const url = `${window.location.origin}${API_BASE_URL}/scan.html?instance_id=${activeQrPollingId}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Public scan link copied to clipboard!', 'success');
      });
    });
  }

  // Delegated click actions for instance cards
  const instancesList = document.getElementById('instancesList');
  if (instancesList) {
    instancesList.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const token = btn.dataset.token;

      if (action === 'qr') {
        openInstanceQrModal(id, name);
      } else if (action === 'copy-api') {
        const url = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${id}&access_token=${token}`;
        navigator.clipboard.writeText(url).then(() => {
          showToast('SendBuddy API URL copied to clipboard!', 'success');
        });
      } else if (action === 'copy-scan') {
        const url = `${window.location.origin}${API_BASE_URL}/scan.html?instance_id=${id}`;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Public scan URL copied to clipboard!', 'success');
        });
      } else if (action === 'copy-token') {
        navigator.clipboard.writeText(token).then(() => {
          showToast('Access Token copied!', 'success');
        });
      } else if (action === 'copy-id') {
        navigator.clipboard.writeText(id).then(() => {
          showToast('Instance ID copied!', 'success');
        });
      } else if (action === 'reset') {
        if (!confirm(`Clear session and generate fresh QR for instance '${name}'?`)) return;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/instances/${id}/reset`, { method: 'POST' });
          const json = await res.json();
          showToast(json.message || 'Session reset initiated.', 'success');
          openInstanceQrModal(id, name);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      } else if (action === 'delete') {
        if (!confirm(`Are you sure you want to permanently delete instance '${name}' (${id})?`)) return;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/instances/${id}`, { method: 'DELETE' });
          const json = await res.json();
          showToast(json.message || 'Instance deleted.', 'success');
          fetchInstances();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      }
    });
  }

  // Default Device Copy Buttons (in deviceTab)
  const btnCopyDefaultId = document.getElementById('btnCopyDefaultId');
  if (btnCopyDefaultId) {
    btnCopyDefaultId.addEventListener('click', () => {
      const id = document.getElementById('defaultInstanceId')?.textContent?.trim() || 'safevault-session';
      navigator.clipboard.writeText(id).then(() => {
        showToast('Default Instance ID copied!', 'success');
      });
    });
  }

  const btnCopyDefaultToken = document.getElementById('btnCopyDefaultToken');
  if (btnCopyDefaultToken) {
    btnCopyDefaultToken.addEventListener('click', () => {
      const token = document.getElementById('defaultAccessToken')?.textContent?.trim() || 'safevault_default_token';
      navigator.clipboard.writeText(token).then(() => {
        showToast('Default Access Token copied!', 'success');
      });
    });
  }

  const btnCopyDefaultApiUrl = document.getElementById('btnCopyDefaultApiUrl');
  if (btnCopyDefaultApiUrl) {
    btnCopyDefaultApiUrl.addEventListener('click', () => {
      const id = document.getElementById('defaultInstanceId')?.textContent?.trim() || 'safevault-session';
      const token = document.getElementById('defaultAccessToken')?.textContent?.trim() || 'safevault_default_token';
      const url = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(id)}&access_token=${encodeURIComponent(token)}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('SendBuddy API URL for Default Device copied!', 'success');
      });
    });
  }
}

async function fetchInstances() {
  const instancesList = document.getElementById('instancesList');
  if (!instancesList) return;

  try {
    const res = await apiFetch('/api/instances');
    const json = await res.json();
    if (!res.ok || !json.success) return;

    instancesCache = json.data || [];
    renderInstances(instancesCache);
    updateInstanceSelectors(instancesCache);
  } catch (err) {
    console.error('Failed to fetch instances:', err);
  }
}

function renderInstances(list) {
  const instancesList = document.getElementById('instancesList');
  if (!instancesList) return;

  if (!list || list.length === 0) {
    instancesList.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📱</div>
        <h3 style="margin-bottom: 0.5rem;">No WhatsApp Instances Created Yet</h3>
        <p class="text-secondary" style="max-width: 440px; margin: 0 auto 1.25rem;">
          Create your first instance to generate a SendBuddy-compatible Instance ID and Access Token for your desktop software.
        </p>
        <button class="btn btn-primary" type="button" onclick="document.getElementById('btnOpenCreateInstance').click()">
          + Create First Instance
        </button>
      </div>
    `;
    return;
  }

  instancesList.innerHTML = list.map((inst) => {
    let badgeClass = 'badge-idle';
    let statusText = inst.status;
    if (inst.isConnected) {
      badgeClass = 'badge-connected';
      statusText = 'Connected';
    } else if (inst.qrReady) {
      badgeClass = 'badge-loading';
      statusText = 'Scan QR Ready';
    } else if (inst.status === 'INITIALIZING') {
      badgeClass = 'badge-loading';
      statusText = 'Initializing';
    }

    return `
      <div class="instance-card">
        <div class="instance-card-header">
          <div class="instance-title-area">
            <h3>${escapeHtml(inst.name)}</h3>
            <span class="instance-id-tag">
              ID: ${inst.id}
              <button class="btn-copy-mini" type="button" data-action="copy-id" data-id="${inst.id}" title="Copy Instance ID">📋</button>
            </span>
          </div>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>

        <div class="credential-box">
          <div class="cred-row">
            <span class="cred-lbl">Phone Number:</span>
            <span class="cred-val">${inst.phone ? '+' + inst.phone : '<span class="text-muted">Not Linked</span>'}</span>
          </div>
          <div class="cred-row">
            <span class="cred-lbl">Access Token:</span>
            <span class="cred-val">
              <code>${(inst.accessToken || '').slice(0, 6)}...${(inst.accessToken || '').slice(-4)}</code>
              <button class="btn-copy-mini" type="button" data-action="copy-token" data-token="${inst.accessToken || ''}" title="Copy Access Token">📋</button>
            </span>
          </div>
          ${inst.pushname ? `
          <div class="cred-row">
            <span class="cred-lbl">Device Name:</span>
            <span class="cred-val">${escapeHtml(inst.pushname)}</span>
          </div>` : ''}
        </div>

        <div class="instance-card-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="qr" data-id="${inst.id}" data-name="${escapeHtml(inst.name)}">
            ${inst.isConnected ? '✓ Linked (View)' : '📷 Pair / QR'}
          </button>
          <button class="btn btn-secondary btn-sm" type="button" data-action="copy-api" data-id="${inst.id}" data-token="${inst.accessToken || ''}" title="Copy SendBuddy API URL">
            API URL
          </button>
          <button class="btn btn-secondary btn-sm" type="button" data-action="copy-scan" data-id="${inst.id}" title="Copy Public Scan URL for Client">
            Scan Link
          </button>
          ${!inst.isDefault ? `
          <button class="btn btn-secondary btn-sm danger" type="button" data-action="reset" data-id="${inst.id}" data-name="${escapeHtml(inst.name)}" title="Reset Session">
            Reset
          </button>
          <button class="btn btn-secondary btn-sm danger" type="button" data-action="delete" data-id="${inst.id}" data-name="${escapeHtml(inst.name)}" title="Delete Instance">
            🗑
          </button>
          ` : `
          <button class="btn btn-secondary btn-sm" type="button" onclick="document.querySelector('[data-tab=deviceTab]').click()" title="Manage Default Primary Device">
            ⚙️ Default Settings
          </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function updateInstanceSelectors(list) {
  const singleSel = document.getElementById('singleInstanceSelect');
  const bulkSel = document.getElementById('bulkInstanceSelect');

  if (!list || list.length === 0) {
    const fallback = `<option value="safevault-session" data-token="safevault_default_token">Default Device (safevault-session)</option>`;
    if (singleSel) singleSel.innerHTML = fallback;
    if (bulkSel) bulkSel.innerHTML = fallback;
    return;
  }

  const options = list.map(i => `
    <option value="${i.id}" data-token="${i.accessToken || ''}">
      ${escapeHtml(i.name)} (${i.id}) - ${i.isConnected ? 'Connected' : i.status}
    </option>
  `).join('');

  if (singleSel) singleSel.innerHTML = options;
  if (bulkSel) bulkSel.innerHTML = options;
}

function openInstanceQrModal(instanceId, name) {
  activeQrPollingId = instanceId;
  const instanceQrModal = document.getElementById('instanceQrModal');
  const modalQrTitle = document.getElementById('modalQrTitle');
  const modalQrSubtitle = document.getElementById('modalQrSubtitle');
  const modalQrLoader = document.getElementById('modalQrLoader');
  const modalLoaderText = document.getElementById('modalLoaderText');
  const modalQrImg = document.getElementById('modalQrImg');
  const modalConnectedBadge = document.getElementById('modalConnectedBadge');
  const modalConnectedPhone = document.getElementById('modalConnectedPhone');

  modalQrTitle.textContent = name ? `Pair: ${name}` : `Instance: ${instanceId}`;
  modalQrSubtitle.textContent = `Instance ID: ${instanceId}`;
  modalQrImg.classList.add('hidden');
  modalQrLoader.classList.remove('hidden');
  modalConnectedBadge.classList.add('hidden');
  modalLoaderText.textContent = 'Generating QR code...';

  instanceQrModal.classList.remove('hidden');

  clearInterval(qrPollingTimer);
  pollInstanceQr();
  qrPollingTimer = setInterval(pollInstanceQr, 2500);

  async function pollInstanceQr() {
    if (!activeQrPollingId) return;
    try {
      const res = await apiFetch(`/api/instances/${activeQrPollingId}/qr`);
      const json = await res.json();
      if (!res.ok || !json.success) return;

      const data = json.data;
      if (data.isConnected) {
        modalQrLoader.classList.add('hidden');
        modalQrImg.classList.add('hidden');
        modalConnectedBadge.classList.remove('hidden');
        modalConnectedPhone.textContent = data.phone ? `+${data.phone}` : 'Active';
      } else if (data.qrReady && data.qrDataUrl) {
        modalQrImg.src = data.qrDataUrl;
        modalQrImg.classList.remove('hidden');
        modalQrLoader.classList.add('hidden');
        modalConnectedBadge.classList.add('hidden');
      } else {
        modalQrImg.classList.add('hidden');
        modalQrLoader.classList.remove('hidden');
        modalLoaderText.textContent = data.status === 'AUTHENTICATING' ? 'Connecting to phone...' : 'Generating QR code...';
      }
    } catch (_) {}
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

