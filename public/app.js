/**
 * Safe Vault WhatsApp SaaS - Super Admin Console Controller
 * 100% English UI, Real-time System Analytics, Tenant & Billing Control
 */

// State
let allUsersCache = [];
let allTransactionsCache = [];
let instancesCache = [];
let activeQrPollingId = null;
let qrPollingTimer = null;
let dashboardRefreshTimer = null;

<<<<<<< HEAD
// Dynamic Base URL detection
=======
// Detect base URL dynamically for subpaths (e.g. /iot/ or /whatsapp_api/) or root deployments
>>>>>>> 48c6ca5121ffd90265c7fc88b6993d1e2da27cd1
const getApiBaseUrl = () => {
  if (window.API_BASE_URL !== undefined) return window.API_BASE_URL;
  const path = window.location.pathname.replace(/\/(index|admin|dashboard)?(\.(php|html))?\/?$/, '');
  return path || '';
};
const API_BASE_URL = getApiBaseUrl();

function apiFetch(endpoint, options = {}) {
  return fetch(`${API_BASE_URL}${endpoint}`, { credentials: 'include', ...options });
}

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginButton = document.getElementById('loginButton');

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const showForgotPassword = document.getElementById('showForgotPassword');
const showLogin = document.getElementById('showLogin');
const recoveryUsername = document.getElementById('recoveryUsername');
const recoveryEmail = document.getElementById('recoveryEmail');
const recoveryCode = document.getElementById('recoveryCode');
const newPassword = document.getElementById('newPassword');
const recoveryError = document.getElementById('recoveryError');
const resetPasswordButton = document.getElementById('resetPasswordButton');

const btnAdminLogout = document.getElementById('btnAdminLogout');
const headerAdminLogout = document.getElementById('headerAdminLogout');

// Admin Profile Dropdown Elements
const adminProfileContainer = document.getElementById('adminProfileContainer');
const adminProfileBtn = document.getElementById('adminProfileBtn');
const adminProfileDropdown = document.getElementById('adminProfileDropdown');
const adminDisplayName = document.getElementById('adminDisplayName');
const adminProfileFullName = document.getElementById('adminProfileFullName');

// Toast
const toast = document.getElementById('toast');

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupAuthHandlers();
  const loggedIn = await restoreAdminSession();
  if (!loggedIn) return;
  startAdminConsole();
});

async function restoreAdminSession() {
  try {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.success) return false;

    document.body.classList.remove('auth-required');
    if (loginScreen) loginScreen.classList.add('hidden');

    if (json.data) {
      if (adminDisplayName) adminDisplayName.textContent = json.data.displayName || json.data.username || 'Administrator';
      if (adminProfileFullName) adminProfileFullName.textContent = json.data.displayName || 'Safe Vault Administrator';
    }
    return true;
  } catch (_) {
    return false;
  }
}

function startAdminConsole() {
  setupNavigationTabs();
  setupProfileDropdown();
  setupDashboardControls();
  setupUserManagement();
  setupBillingManagement();
  setupInstancesManagement();

  // Load all initial data
  loadDashboardStats();
  loadUsers();
  loadTransactions();
  loadInstances();

  // Auto-refresh dashboard metrics every 30s
  clearInterval(dashboardRefreshTimer);
  dashboardRefreshTimer = setInterval(() => {
    loadDashboardStats(true);
  }, 30000);
}

// ==========================================================================
// Authentication Handlers
// ==========================================================================
function setupAuthHandlers() {
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      loginButton.disabled = true;
      loginButton.textContent = 'Authenticating...';

<<<<<<< HEAD
      try {
        const res = await apiFetch('/api/auth/login', {
=======
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
      if (targetTabId === 'usersTab') fetchUsers();
    });
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

async function fetchUsers() {
  const usersList = document.getElementById('usersList');
  if (!usersList) return;
  try {
    const response = await apiFetch('/api/admin/users');
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || 'Unable to load users.');
    const users = json.data || [];
    usersList.innerHTML = users.length ? users.map((user) => `<tr><td>${escapeHtml(user.fullName)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.email)}</td><td>${user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</td></tr>`).join('') : '<tr><td colspan="4" class="text-secondary">No registered users yet.</td></tr>';
  } catch (error) {
    usersList.innerHTML = `<tr><td colspan="4" class="login-error">${escapeHtml(error.message)}</td></tr>`;
  }
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

  const bulkPreview = document.getElementById('bulkMessagePreview');
  const bulkPreviewTime = document.getElementById('bulkPreviewTime');
  const singlePreview = document.getElementById('singleMessagePreview');
  const singlePreviewTime = document.getElementById('singlePreviewTime');

  bulkMessageInput.addEventListener('input', () => {
    charCountBadge.textContent = `${bulkMessageInput.value.length} Chars`;
    if (bulkPreview) {
      bulkPreview.textContent = bulkMessageInput.value || 'Type your message above to see preview...';
    }
    if (bulkPreviewTime) {
      bulkPreviewTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  });

  if (singleMessage && singlePreview) {
    singleMessage.addEventListener('input', () => {
      singlePreview.textContent = singleMessage.value || 'Type your message above to see preview...';
      if (singlePreviewTime) {
        singlePreviewTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    });
  }

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
>>>>>>> 48c6ca5121ffd90265c7fc88b6993d1e2da27cd1
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: loginUsername.value.trim(),
            password: loginPassword.value
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Invalid administrator username or password.');
        }

        document.body.classList.remove('auth-required');
        loginScreen.classList.add('hidden');
        showToast('Super Admin authenticated successfully!', 'success');
        startAdminConsole();
      } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.remove('hidden');
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In as Super Administrator';
      }
    });
  }

  // Logout Handlers
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    window.location.reload();
  };

  if (btnAdminLogout) btnAdminLogout.addEventListener('click', handleLogout);
  if (headerAdminLogout) headerAdminLogout.addEventListener('click', handleLogout);

  // Forgot password toggles
  if (showForgotPassword) {
    showForgotPassword.addEventListener('click', () => {
      loginForm.classList.add('hidden');
      forgotPasswordForm.classList.remove('hidden');
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', () => {
      forgotPasswordForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      recoveryError.classList.add('hidden');
      resetPasswordButton.disabled = true;
      resetPasswordButton.textContent = 'Verifying...';

      try {
        const res = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: recoveryUsername.value.trim(),
            email: recoveryEmail.value.trim(),
            recoveryCode: recoveryCode.value.trim(),
            newPassword: newPassword.value
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to verify recovery details.');
        }

        showToast('Admin password updated! Please sign in.', 'success');
        forgotPasswordForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        loginPassword.value = '';
      } catch (err) {
        recoveryError.textContent = err.message;
        recoveryError.classList.remove('hidden');
      } finally {
        resetPasswordButton.disabled = false;
        resetPasswordButton.textContent = 'Update Password';
      }
    });
  }
}

// ==========================================================================
// Navigation & Profile Menu
// ==========================================================================
function setupNavigationTabs() {
  const navItems = document.querySelectorAll('.admin-nav-item');
  const panels = document.querySelectorAll('.tab-panel');

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (!targetTab) return;

      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      panels.forEach((p) => {
        if (p.id === targetTab) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      // Lazy refresh for selected tab
      if (targetTab === 'usersTab') loadUsers();
      if (targetTab === 'billingTab') loadTransactions();
      if (targetTab === 'instancesTab') loadInstances();
    });
  });

  // Profile dropdown shortcuts
  document.querySelectorAll('[data-jump-tab]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.jumpTab;
      const targetBtn = document.querySelector(`.admin-nav-item[data-tab="${target}"]`);
      if (targetBtn) targetBtn.click();
      if (adminProfileDropdown) adminProfileDropdown.classList.add('hidden');
    });
  });
}

function setupProfileDropdown() {
  if (!adminProfileBtn || !adminProfileDropdown) return;

  adminProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = adminProfileDropdown.classList.contains('hidden');
    adminProfileDropdown.classList.toggle('hidden', !isHidden);
    adminProfileBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!adminProfileContainer?.contains(e.target)) {
      adminProfileDropdown.classList.add('hidden');
      adminProfileBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ==========================================================================
// Tab 1: System Dashboard Overview
// ==========================================================================
function setupDashboardControls() {
  const btnRefresh = document.getElementById('btnRefreshDashboard');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadDashboardStats();
      showToast('Dashboard metrics refreshed.', 'success');
    });
  }

  const btnQuickCreate = document.getElementById('btnQuickCreateInst');
  if (btnQuickCreate) {
    btnQuickCreate.addEventListener('click', () => {
      document.getElementById('createInstanceModal')?.classList.remove('hidden');
    });
  }
}

async function loadDashboardStats(isBackground = false) {
  try {
    const res = await apiFetch('/api/admin/dashboard-stats');
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;

    const { users, instances, dispatches, revenue, recentActivity } = json.data;

    // 1. Users KPI
    const kpiTotalUsers = document.getElementById('kpiTotalUsers');
    const kpiActiveUsers = document.getElementById('kpiActiveUsers');
    const sidebarUserCount = document.getElementById('sidebarUserCount');
    if (kpiTotalUsers) kpiTotalUsers.textContent = users.total || 0;
    if (kpiActiveUsers) kpiActiveUsers.textContent = `${users.active || 0} Active`;
    if (sidebarUserCount) sidebarUserCount.textContent = users.total || 0;

    // 2. Instances KPI
    const kpiConnectedSessions = document.getElementById('kpiConnectedSessions');
    const kpiTotalSessions = document.getElementById('kpiTotalSessions');
    const kpiPendingQrSessions = document.getElementById('kpiPendingQrSessions');
    const sidebarInstCount = document.getElementById('sidebarInstCount');
    if (kpiConnectedSessions) kpiConnectedSessions.textContent = instances.connected || 0;
    if (kpiTotalSessions) kpiTotalSessions.textContent = `${instances.total || 0} Total`;
    if (kpiPendingQrSessions) kpiPendingQrSessions.textContent = `${instances.pendingQr || 0} QR Ready`;
    if (sidebarInstCount) sidebarInstCount.textContent = instances.total || 0;

    // 3. Dispatches KPI
    const kpiTodayDispatches = document.getElementById('kpiTodayDispatches');
    const kpiSuccessRate = document.getElementById('kpiSuccessRate');
    const kpiTotalDispatches = document.getElementById('kpiTotalDispatches');
    if (kpiTodayDispatches) kpiTodayDispatches.textContent = (dispatches.today || 0).toLocaleString();
    if (kpiSuccessRate) kpiSuccessRate.textContent = `${dispatches.successRate || 100}% Success`;
    if (kpiTotalDispatches) kpiTotalDispatches.textContent = `${(dispatches.total || 0).toLocaleString()} Lifetime`;

    // 4. Revenue KPI
    const kpiTotalRevenue = document.getElementById('kpiTotalRevenue');
    const kpiTodayRevenue = document.getElementById('kpiTodayRevenue');
    const kpiTotalOrders = document.getElementById('kpiTotalOrders');
    const sidebarRevenueBadge = document.getElementById('sidebarRevenueBadge');
    const revTotal = revenue.totalRevenue || 0;
    if (kpiTotalRevenue) kpiTotalRevenue.textContent = `₹${revTotal.toLocaleString()}`;
    if (kpiTodayRevenue) kpiTodayRevenue.textContent = `+₹${(revenue.todayRevenue || 0).toLocaleString()} Today`;
    if (kpiTotalOrders) kpiTotalOrders.textContent = `${revenue.totalTransactions || 0} Orders`;
    if (sidebarRevenueBadge) {
      sidebarRevenueBadge.textContent = revTotal >= 1000 ? `₹${(revTotal / 1000).toFixed(1)}k` : `₹${revTotal}`;
    }

    // Render Recent Platform Activity
    renderDashboardRecentActivity(recentActivity || []);

    // Render Quick Instances List
    loadDashboardInstancesList();
  } catch (err) {
    if (!isBackground) console.error('Error loading dashboard stats:', err);
  }
}

async function loadDashboardInstancesList() {
  const container = document.getElementById('dashboardInstancesList');
  if (!container) return;

  try {
    const res = await apiFetch('/api/admin/instances');
    const json = await res.json();
    if (!res.ok || !json.success) return;

    const list = json.data || [];
    if (list.length === 0) {
      container.innerHTML = `<p class="text-secondary" style="font-size: 0.85rem; padding: 1rem 0;">No active WhatsApp instances found.</p>`;
      return;
    }

    container.innerHTML = list.slice(0, 5).map((inst) => {
      const isConn = inst.isConnected;
      const statusClass = isConn ? 'status-connected' : (inst.qrReady ? 'status-authenticating' : 'status-disconnected');
      const statusLabel = isConn ? 'Connected' : (inst.qrReady ? 'QR Ready' : inst.status);

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📱</div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a;">${escapeHtml(inst.name)}</div>
              <div style="font-size: 0.75rem; color: #64748b;">${inst.phone ? '+' + inst.phone : 'Not Linked'} &bull; ${escapeHtml(inst.ownerName || 'Admin')}</div>
            </div>
          </div>
          <span class="status-pill ${statusClass}" style="font-size: 0.72rem; padding: 0.15rem 0.55rem;">${statusLabel}</span>
        </div>
      `;
    }).join('');
  } catch (_) {}
}

function renderDashboardRecentActivity(activities) {
  const container = document.getElementById('dashboardRecentActivity');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = `<p class="text-secondary" style="font-size: 0.85rem; padding: 1rem 0;">No message dispatches recorded yet.</p>`;
    return;
  }

  container.innerHTML = activities.map((act) => {
    const isSent = act.status === 'sent';
    const pillClass = isSent ? 'dispatch-status-pill sent' : 'dispatch-status-pill failed';
    const timeFormatted = formatTimeAgo(act.timestamp);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.82rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span class="dispatch-recipient-badge" style="font-size: 0.78rem;">+${act.recipient || '91XXXXXXXXXX'}</span>
          <span style="color: #475569; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(act.preview || 'Dispatched WhatsApp alert')}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span class="${pillClass}" style="font-size: 0.7rem; padding: 0.15rem 0.55rem;">${act.status.toUpperCase()}</span>
          <span style="color: #94a3b8; font-size: 0.75rem;">${timeFormatted}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// Tab 2: User Management & Subscription Control
// ==========================================================================
function setupUserManagement() {
  const searchInput = document.getElementById('userSearchInput');
  const statusFilter = document.getElementById('userStatusFilter');
  const planFilter = document.getElementById('userPlanFilter');
  const btnReload = document.getElementById('btnReloadUsers');

  if (searchInput) searchInput.addEventListener('input', applyUserFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyUserFilters);
  if (planFilter) planFilter.addEventListener('change', applyUserFilters);
  if (btnReload) btnReload.addEventListener('click', () => { loadUsers(); showToast('Users refreshed.', 'success'); });

  // Delegated user actions (Topup, Plan, Toggle status, Reset, Delete)
  const usersTbody = document.getElementById('adminUsersTableBody');
  if (usersTbody) {
    usersTbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-user-action]');
      if (!btn) return;

      const action = btn.dataset.userAction;
      const userId = btn.dataset.userId;
      const user = allUsersCache.find((u) => u.id === userId);
      if (!user) return;

      if (action === 'topup') {
        openTopupModal(user);
      } else if (action === 'plan') {
        openChangePlanModal(user);
      } else if (action === 'toggle-status') {
        const nextStatus = user.status === 'active' ? 'inactive' : 'active';
        const confirmMsg = nextStatus === 'inactive'
          ? `Suspend account for '${user.fullName || user.username}'? User will not be able to log in.`
          : `Re-activate account for '${user.fullName || user.username}'?`;
        if (!confirm(confirmMsg)) return;

        btn.disabled = true;
        try {
          const res = await apiFetch('/api/admin/users/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status: nextStatus })
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update status.');
          showToast(json.message || `User status set to ${nextStatus}.`, 'success');
          loadUsers();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      } else if (action === 'reset-session') {
        if (!confirm(`Force disconnect and reset WhatsApp session for '${user.fullName || user.username}'?`)) return;
        btn.disabled = true;
        try {
          const res = await apiFetch('/api/admin/users/reset-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to reset session.');
          showToast(json.message || 'Session reset successfully.', 'success');
          loadUsers();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      } else if (action === 'delete') {
        if (!confirm(`Are you SURE you want to permanently delete user '${user.fullName || user.username}'? This cannot be undone.`)) return;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete user.');
          showToast(json.message || 'User deleted permanently.', 'success');
          loadUsers();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      }
    });
  }

  // Modals setup
  setupTopupModal();
  setupPlanModal();
}

async function loadUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/api/admin/users');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Could not fetch users.');

    allUsersCache = json.data || [];
    applyUserFilters();
  } catch (err) {
    console.error('Failed to load users:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger" style="text-align: center; padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function applyUserFilters() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
  const planFilter = document.getElementById('userPlanFilter')?.value || 'all';

  let filtered = allUsersCache.filter((u) => {
    const matchesSearch = !searchTerm ||
      (u.fullName && u.fullName.toLowerCase().includes(searchTerm)) ||
      (u.username && u.username.toLowerCase().includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm));

    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesPlan = planFilter === 'all' || (u.plan && u.plan.toLowerCase().includes(planFilter.toLowerCase()));

    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-secondary" style="text-align: center; padding: 2rem;">No registered users match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u) => {
    const quota = u.messageQuota || 2500;
    const used = u.messagesUsed || 0;
    const remaining = Math.max(0, quota - used);
    const percent = Math.min(100, Math.round((used / quota) * 100));
    const isSuspended = u.status === 'inactive';

    const inst = u.instance;
    let instStatusHtml = `<span style="color: #94a3b8; font-size: 0.78rem;">No Instance</span>`;
    if (inst) {
      const isConn = inst.isConnected;
      const dotColor = isConn ? '#22c55e' : (inst.status === 'QR_READY' ? '#f59e0b' : '#ef4444');
      instStatusHtml = `
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor};"></span>
          <div>
            <div style="font-weight: 600; font-size: 0.82rem; color: #0f172a;">${inst.phone ? '+' + inst.phone : 'Scan QR Pending'}</div>
            <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">ID: ${inst.id}</div>
          </div>
        </div>
      `;
    }

    const initial = (u.fullName || u.username || 'U')[0].toUpperCase();
    const joinedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-';

    return `
      <tr>
        <td>
          <div class="admin-user-cell">
            <div class="admin-user-avatar">${initial}</div>
            <div>
              <div class="admin-user-name">${escapeHtml(u.fullName || u.username)}</div>
              <div class="admin-user-sub">@${escapeHtml(u.username)} &bull; ${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${u.plan?.includes('Pro') ? 'badge-tag' : 'badge-idle'}" style="font-size: 0.75rem;">
            ${escapeHtml(u.plan || 'Standard Plan')}
          </span>
        </td>
        <td>
          <div class="admin-quota-cell">
            <div class="admin-quota-text">
              <span>${used.toLocaleString()} / ${quota.toLocaleString()}</span>
              <span style="color: #16a34a; font-weight: 700;">${remaining.toLocaleString()} left</span>
            </div>
            <div class="admin-quota-track">
              <div class="admin-quota-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        </td>
        <td>${instStatusHtml}</td>
        <td>
          <span class="status-pill ${isSuspended ? 'status-disconnected' : 'status-connected'}" style="font-size: 0.72rem; padding: 0.15rem 0.55rem;">
            ${isSuspended ? 'Suspended' : 'Active'}
          </span>
        </td>
        <td style="font-size: 0.82rem; color: #64748b;">${joinedDate}</td>
        <td style="text-align: right;">
          <div class="admin-action-btn-group" style="justify-content: flex-end;">
            <button class="btn-action-mini primary" type="button" data-user-action="topup" data-user-id="${u.id}" title="Grant message credits">
              ⚡ Top-Up
            </button>
            <button class="btn-action-mini" type="button" data-user-action="plan" data-user-id="${u.id}" title="Switch subscription tier">
              🏷️ Plan
            </button>
            <button class="btn-action-mini ${isSuspended ? 'primary' : 'danger'}" type="button" data-user-action="toggle-status" data-user-id="${u.id}" title="${isSuspended ? 'Activate' : 'Suspend'}">
              ${isSuspended ? 'Activate' : 'Suspend'}
            </button>
            ${inst ? `
            <button class="btn-action-mini" type="button" data-user-action="reset-session" data-user-id="${u.id}" title="Force reset WhatsApp session">
              🔁 Reset
            </button>` : ''}
            <button class="btn-action-mini danger" type="button" data-user-action="delete" data-user-id="${u.id}" title="Delete account">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// Top-Up Credits Modal Handlers
// --------------------------------------------------------------------------
function setupTopupModal() {
  const modal = document.getElementById('topupCreditsModal');
  const btnClose = document.getElementById('btnCloseTopupModal');
  const btnCancel = document.getElementById('btnCancelTopupModal');
  const form = document.getElementById('topupCreditsForm');
  const amountInput = document.getElementById('topupAmountInput');

  const closeModal = () => modal?.classList.add('hidden');
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Quick preset pills
  modal?.querySelectorAll('.preset-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      if (amountInput) amountInput.value = pill.dataset.preset;
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('topupUserId')?.value;
      const amount = parseInt(amountInput.value, 10);
      const mode = document.getElementById('topupModeSelect')?.value || 'add';

      const btnSubmit = document.getElementById('btnSubmitTopup');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Applying...'; }

      try {
        const res = await apiFetch('/api/admin/users/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount, mode })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update credits.');

        showToast(json.message || 'Credits granted successfully!', 'success');
        closeModal();
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Apply Credit Grant'; }
      }
    });
  }
}

function openTopupModal(user) {
  const modal = document.getElementById('topupCreditsModal');
  const subtitle = document.getElementById('topupModalUserSubtitle');
  const quotaDisplay = document.getElementById('topupCurrentQuotaDisplay');
  const userIdInput = document.getElementById('topupUserId');
  const amountInput = document.getElementById('topupAmountInput');

  if (subtitle) subtitle.textContent = `User: ${user.fullName || user.username} (@${user.username})`;
  if (quotaDisplay) quotaDisplay.textContent = `${(user.messageQuota || 2500).toLocaleString()} Credits`;
  if (userIdInput) userIdInput.value = user.id;
  if (amountInput) amountInput.value = '5000';

  modal?.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// Change Plan Modal Handlers
// --------------------------------------------------------------------------
function setupPlanModal() {
  const modal = document.getElementById('changePlanModal');
  const btnClose = document.getElementById('btnClosePlanModal');
  const btnCancel = document.getElementById('btnCancelPlanModal');
  const form = document.getElementById('changePlanForm');
  const planSelect = document.getElementById('planSelect');
  const customFields = document.getElementById('customPlanFields');

  const closeModal = () => modal?.classList.add('hidden');
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (planSelect && customFields) {
    planSelect.addEventListener('change', () => {
      customFields.classList.toggle('hidden', planSelect.value !== 'custom');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('planUserId')?.value;
      const planKey = planSelect?.value;
      const customQuota = parseInt(document.getElementById('customQuotaInput')?.value || '5000', 10);
      const customDays = parseInt(document.getElementById('customDaysInput')?.value || '30', 10);

      const btnSubmit = document.getElementById('btnSubmitChangePlan');
      if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Updating...'; }

      try {
        const res = await apiFetch('/api/admin/users/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, planKey, customQuota, customDays })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update plan.');

        showToast(json.message || 'Subscription plan updated successfully!', 'success');
        closeModal();
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Update Subscription'; }
      }
    });
  }
}

function openChangePlanModal(user) {
  const modal = document.getElementById('changePlanModal');
  const subtitle = document.getElementById('planModalUserSubtitle');
  const userIdInput = document.getElementById('planUserId');
  const planSelect = document.getElementById('planSelect');

  if (subtitle) subtitle.textContent = `User: ${user.fullName || user.username} (@${user.username}) &bull; Current: ${user.plan || 'Standard'}`;
  if (userIdInput) userIdInput.value = user.id;

  if (planSelect) {
    if (user.plan?.toLowerCase().includes('starter')) planSelect.value = 'starter';
    else if (user.plan?.toLowerCase().includes('agency')) planSelect.value = 'agency';
    else planSelect.value = 'pro';
  }

  modal?.classList.remove('hidden');
}

// ==========================================================================
// Tab 3: Razorpay Billing & Transactions
// ==========================================================================
function setupBillingManagement() {
  const searchInput = document.getElementById('txSearchInput');
  const btnReload = document.getElementById('btnReloadTransactions');
  const btnExport = document.getElementById('btnExportTransactionsCsv');

  if (searchInput) searchInput.addEventListener('input', applyTransactionFilters);
  if (btnReload) btnReload.addEventListener('click', () => { loadTransactions(); showToast('Orders refreshed.', 'success'); });
  if (btnExport) btnExport.addEventListener('click', exportTransactionsCsv);
}

async function loadTransactions() {
  const tbody = document.getElementById('adminTransactionsTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/api/admin/transactions');
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load billing history.');

    allTransactionsCache = json.data || [];
    applyTransactionFilters();

    // Update billing summary strip
    const grossRev = allTransactionsCache.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRev = allTransactionsCache
      .filter((t) => t.createdAt && t.createdAt.startsWith(todayStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const grossEl = document.getElementById('billingGrossRevenue');
    const totalOrdersEl = document.getElementById('billingTotalOrders');
    const todayCollEl = document.getElementById('billingTodayCollections');

    if (grossEl) grossEl.textContent = `₹${grossRev.toLocaleString()}`;
    if (totalOrdersEl) totalOrdersEl.textContent = allTransactionsCache.length;
    if (todayCollEl) todayCollEl.textContent = `₹${todayRev.toLocaleString()}`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-danger" style="text-align: center; padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function applyTransactionFilters() {
  const tbody = document.getElementById('adminTransactionsTableBody');
  if (!tbody) return;

  const search = (document.getElementById('txSearchInput')?.value || '').trim().toLowerCase();

  const filtered = allTransactionsCache.filter((t) => {
    if (!search) return true;
    return (t.userName && t.userName.toLowerCase().includes(search)) ||
      (t.userEmail && t.userEmail.toLowerCase().includes(search)) ||
      (t.orderId && t.orderId.toLowerCase().includes(search)) ||
      (t.paymentId && t.paymentId.toLowerCase().includes(search)) ||
      (t.planName && t.planName.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-secondary" style="text-align: center; padding: 2rem;">No billing transactions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t) => {
    const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleString() : '-';
    return `
      <tr>
        <td>
          <div style="font-weight: 700; font-family: monospace; font-size: 0.82rem; color: #0f172a;">${escapeHtml(t.orderId || t.id)}</div>
          <div style="font-size: 0.72rem; color: #94a3b8;">${t.id}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(t.userName || 'Customer')}</div>
          <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(t.userEmail || '')}</div>
        </td>
        <td>
          <span class="badge badge-tag" style="font-size: 0.75rem;">${escapeHtml(t.planName || 'Plan Purchase')}</span>
          ${t.creditsAdded ? `<div style="font-size: 0.72rem; color: #16a34a; font-weight: 600; margin-top: 2px;">+${t.creditsAdded.toLocaleString()} credits</div>` : ''}
        </td>
        <td style="font-weight: 800; font-size: 1rem; color: #0f172a;">₹${(t.amount || 0).toLocaleString()}</td>
        <td>
          <code style="font-size: 0.8rem; background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px;">${escapeHtml(t.paymentId || 'N/A')}</code>
        </td>
        <td style="font-size: 0.82rem; color: #475569;">${escapeHtml(t.method || 'Razorpay UPI')}</td>
        <td>
          <span class="status-pill status-connected" style="font-size: 0.72rem; padding: 0.15rem 0.55rem;">
            ✓ ${escapeHtml(t.status?.toUpperCase() || 'PAID')}
          </span>
        </td>
        <td style="font-size: 0.82rem; color: #64748b;">${formattedDate}</td>
      </tr>
    `;
  }).join('');
}

function exportTransactionsCsv() {
  if (!allTransactionsCache.length) {
    showToast('No transaction data to export.', 'error');
    return;
  }

  const headers = ['Transaction ID', 'Order ID', 'Payment Gateway ID', 'Customer Name', 'Customer Email', 'Plan Name', 'Amount (INR)', 'Credits Added', 'Method', 'Status', 'Date Time'];
  const rows = allTransactionsCache.map((t) => [
    t.id,
    t.orderId || '',
    t.paymentId || '',
    `"${(t.userName || '').replace(/"/g, '""')}"`,
    t.userEmail || '',
    `"${(t.planName || '').replace(/"/g, '""')}"`,
    t.amount || 0,
    t.creditsAdded || 0,
    `"${(t.method || '').replace(/"/g, '""')}"`,
    t.status || 'captured',
    t.createdAt || ''
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `safevault_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Transaction CSV exported successfully!', 'success');
}

// ==========================================================================
// Tab 4: WhatsApp Instances Monitor & Management
// ==========================================================================
function setupInstancesManagement() {
  const btnOpenCreate = document.getElementById('btnOpenCreateInstance');
  const createModal = document.getElementById('createInstanceModal');
  const btnCloseCreate = document.getElementById('btnCloseCreateModal');
  const btnCancelCreate = document.getElementById('btnCancelCreateModal');
  const createForm = document.getElementById('createInstanceForm');

  const closeCreate = () => createModal?.classList.add('hidden');
  if (btnOpenCreate) btnOpenCreate.addEventListener('click', () => createModal?.classList.remove('hidden'));
  if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreate);
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreate);

  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('instanceNameInput');
      const name = nameInput.value.trim();
      const btnSubmit = document.getElementById('btnSubmitCreateInstance');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Creating...';

      try {
        const res = await apiFetch('/api/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create instance.');

        showToast(`Instance '${name}' created successfully!`, 'success');
        closeCreate();
        nameInput.value = '';
        loadInstances();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Create & Generate Token';
      }
    });
  }

  // QR Modal setup
  const qrModal = document.getElementById('instanceQrModal');
  const btnCloseQr = document.getElementById('btnCloseQrModal');
  if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
      qrModal?.classList.add('hidden');
      clearInterval(qrPollingTimer);
      activeQrPollingId = null;
    });
  }

  const btnCopyPublicScan = document.getElementById('btnCopyPublicScanLink');
  if (btnCopyPublicScan) {
    btnCopyPublicScan.addEventListener('click', () => {
      const instance = instancesCache.find((i) => i.id === activeQrPollingId);
      const url = `${window.location.origin}${API_BASE_URL}/scan.html?instance_id=${encodeURIComponent(activeQrPollingId)}&access_token=${encodeURIComponent(instance?.accessToken || '')}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Public client scan link copied to clipboard!', 'success');
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
        const url = `${window.location.origin}${API_BASE_URL}/scan.html?instance_id=${encodeURIComponent(id)}&access_token=${encodeURIComponent(token)}`;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Client scan link copied!', 'success');
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
        if (!confirm(`Clear session and generate fresh QR for '${name}'?`)) return;
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
        if (!confirm(`Permanently delete instance '${name}' (${id})?`)) return;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/instances/${id}`, { method: 'DELETE' });
          const json = await res.json();
          showToast(json.message || 'Instance deleted.', 'success');
          loadInstances();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      }
    });
  }
}

async function loadInstances() {
  const instancesList = document.getElementById('instancesList');
  if (!instancesList) return;

  try {
    const res = await apiFetch('/api/admin/instances');
    const json = await res.json();
    if (!res.ok || !json.success) return;

    instancesCache = json.data || [];
    renderInstancesList(instancesCache);
  } catch (err) {
    console.error('Failed to load instances:', err);
  }
}

function renderInstancesList(list) {
  const container = document.getElementById('instancesList');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📱</div>
        <h3 style="margin-bottom: 0.5rem;">No WhatsApp Instances Created Yet</h3>
        <p class="text-secondary" style="max-width: 440px; margin: 0 auto 1.25rem;">
          Create your first instance to generate SendBuddy-compatible credentials for users or ERP software.
        </p>
        <button class="btn btn-primary" type="button" onclick="document.getElementById('btnOpenCreateInstance').click()">
          + Create First Instance
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((inst) => {
    let badgeClass = 'badge-idle';
    let statusText = inst.status;
    if (inst.isConnected) {
      badgeClass = 'badge-connected';
      statusText = 'Connected';
    } else if (inst.qrReady) {
      badgeClass = 'badge-loading';
      statusText = 'QR Ready';
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
            <span class="cred-lbl">Assigned Tenant:</span>
            <span class="cred-val" style="font-weight: 700; color: #0284c7;">${escapeHtml(inst.ownerName || 'Admin')}</span>
          </div>
          <div class="cred-row">
            <span class="cred-lbl">Linked Phone:</span>
            <span class="cred-val">${inst.phone ? '+' + inst.phone : '<span class="text-muted">Not Linked</span>'}</span>
          </div>
          <div class="cred-row">
            <span class="cred-lbl">Access Token:</span>
            <span class="cred-val">
              <code>${(inst.accessToken || '').slice(0, 6)}...${(inst.accessToken || '').slice(-4)}</code>
              <button class="btn-copy-mini" type="button" data-action="copy-token" data-token="${inst.accessToken || ''}" title="Copy Token">📋</button>
            </span>
          </div>
        </div>

        <div class="instance-card-actions">
          <button class="btn btn-primary btn-sm" type="button" data-action="qr" data-id="${inst.id}" data-name="${escapeHtml(inst.name)}">
            ${inst.isConnected ? '✓ Linked' : '📷 Pair / QR'}
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
          <span style="font-size: 0.75rem; color: #64748b; padding: 0.25rem 0.5rem; background: #f1f5f9; border-radius: 4px;">Primary Session</span>
          `}
        </div>
      </div>
    `;
  }).join('');
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

// ==========================================================================
// Toast & Utility Helpers
// ==========================================================================
let toastTimer = null;
function showToast(message, type = 'info') {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
