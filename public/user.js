const auth = document.getElementById('userAuth');
const dashboard = document.getElementById('userDashboard');
const connectScreen = document.getElementById('userConnectScreen');
const connectPendingView = document.getElementById('connectPendingView');
const connectSuccessView = document.getElementById('connectSuccessView');
const connectQrImage = document.getElementById('connectQrImage');
const connectQrLoader = document.getElementById('connectQrLoader');
const connectQrLoaderText = document.getElementById('connectQrLoaderText');
const connectStatusBadge = document.getElementById('connectStatusBadge');
const connectQrFooterStatus = document.getElementById('connectQrFooterStatus');
const connectSuccessPushName = document.getElementById('connectSuccessPushName');
const connectSuccessPhoneDetails = document.getElementById('connectSuccessPhoneDetails');
const connectUserName = document.getElementById('connectUserName');
const connectUserAvatar = document.getElementById('connectUserAvatar');
const loginForm = document.getElementById('userLoginForm');
const registerForm = document.getElementById('userRegisterForm');
const userAuthError = document.getElementById('userAuthError');
const registerError = document.getElementById('registerError');
let myInstance;
let pollTimer;
let isRedirectingToDashboard = false;

function showScreen(screen) {
  if (auth) auth.classList.toggle('hidden', screen !== 'auth');
  if (connectScreen) connectScreen.classList.toggle('hidden', screen !== 'connect');
  if (dashboard) dashboard.classList.toggle('hidden', screen !== 'dashboard');
}

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

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
}

function showLogin() {
  if (loginForm) loginForm.classList.remove('hidden');
  if (registerForm) registerForm.classList.add('hidden');
  if (userAuthError) userAuthError.classList.add('hidden');
}

function showRegister() {
  if (registerForm) registerForm.classList.remove('hidden');
  if (loginForm) loginForm.classList.add('hidden');
  if (registerError) registerError.classList.add('hidden');
}

document.getElementById('showRegister')?.addEventListener('click', showRegister);
document.getElementById('showUserLogin')?.addEventListener('click', showLogin);

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (userAuthError) userAuthError.classList.add('hidden');

    const uInput = document.getElementById('userLoginUsername');
    const pInput = document.getElementById('userLoginPassword');
    const username = uInput ? uInput.value.trim() : '';
    const password = pInput ? pInput.value : '';

    if (!username || !password) {
      return showError(userAuthError, 'Please enter both username and password.');
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
    }

    try {
      const response = await api('/api/user-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.safeJson();
      if (!response.ok) {
        return showError(userAuthError, data.error || 'Invalid credentials or login failed.');
      }
      handleUserSession(data.data);
    } catch (err) {
      showError(userAuthError, err.message || 'Unable to connect to login service.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Workspace';
      }
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (registerError) registerError.classList.add('hidden');

    const fnInput = document.getElementById('registerFullName');
    const uInput = document.getElementById('registerUsername');
    const eInput = document.getElementById('registerEmail');
    const pInput = document.getElementById('registerPassword');

    const fullName = fnInput ? fnInput.value.trim() : '';
    const username = uInput ? uInput.value.trim() : '';
    const email = eInput ? eInput.value.trim() : '';
    const password = pInput ? pInput.value : '';

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
    }

    try {
      const response = await api('/api/user-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, email, password })
      });
      const data = await response.safeJson();
      if (!response.ok) {
        return showError(registerError, data.error || 'Registration failed.');
      }

      showLogin();
      const loginU = document.getElementById('userLoginUsername');
      if (loginU) loginU.value = username;
      const loginP = document.getElementById('userLoginPassword');
      if (loginP) loginP.value = '';
      showError(userAuthError, 'Account created! Please sign in with your credentials.');
      if (userAuthError) userAuthError.style.color = '#008069';
    } catch (err) {
      showError(registerError, err.message || 'Unable to register.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account & Start Free Trial';
      }
    }
  });
}
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-user-tab]');
  if (!tabBtn) return;
  const targetId = tabBtn.dataset.userTab;
  document.querySelectorAll('.sidebar-nav-item').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.user-tab-panel').forEach((panel) => panel.classList.remove('active'));

  const matchingNav = document.querySelector(`.sidebar-nav-item[data-user-tab="${targetId}"]`);
  if (matchingNav) matchingNav.classList.add('active');
  else tabBtn.classList.add('active');

  const panel = document.getElementById(targetId);
  if (panel) panel.classList.add('active');

  if (targetId === 'templatesTab') loadTemplates();
  if (targetId === 'logsTab') { loadLogs(); loadStats(); }
  if (targetId === 'apiDocsTab' && myInstance) renderWooCommerceSnippet();
  if (targetId === 'plansTab') loadPlansPage();
  if (targetId === 'settingsTab') loadSettingsPage();
  if (targetId === 'myDeviceTab' && myInstance) refreshQr();

  // Close mobile sidebar if open
  const mobileSb = document.getElementById('workspaceSidebar') || document.getElementById('workspaceSidebarRight');
  mobileSb?.classList.remove('mobile-open');
});

let currentUser = null;

function updateUserQuotaDisplay(u) {
  if (!u) return;
  currentUser = u;
  const quota = u.messageQuota || 2500;
  const remaining = typeof u.creditsRemaining === 'number' ? u.creditsRemaining : (quota - (u.messagesUsed || 0));
  const percent = Math.min(100, Math.max(0, Math.round((remaining / quota) * 100)));

  // Header Plan Tag
  const headerPlanEl = document.getElementById('headerPlanText');
  if (headerPlanEl) {
    const raw = (u.plan || 'PRO SAAS').toUpperCase();
    headerPlanEl.textContent = raw.includes('PLAN') ? raw : `${raw} PLAN`;
  }

  // Dropdown & Sidebar Quotas
  if (document.getElementById('sidebarQuotaVal')) document.getElementById('sidebarQuotaVal').textContent = `${remaining.toLocaleString()} / ${quota.toLocaleString()}`;
  if (document.getElementById('dropdownCreditsVal')) document.getElementById('dropdownCreditsVal').textContent = `${remaining.toLocaleString()} / ${quota.toLocaleString()}`;

  if (document.getElementById('sidebarQuotaBar')) document.getElementById('sidebarQuotaBar').style.width = `${percent}%`;
  if (document.getElementById('dropdownCreditsBar')) document.getElementById('dropdownCreditsBar').style.width = `${percent}%`;

  const kpiEl = document.getElementById('kpiCreditsRemaining');
  if (kpiEl) kpiEl.textContent = remaining.toLocaleString();

  const planEl = document.getElementById('sidebarPlanTag');
  if (planEl) planEl.textContent = `⚡ ${u.plan || 'PRO SAAS'}`;

  if (u.planExpiresAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(u.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
    if (document.getElementById('sidebarQuotaExpiry')) document.getElementById('sidebarQuotaExpiry').textContent = `${daysLeft} Days Validity`;
    if (document.getElementById('dropdownCreditsExpiry')) document.getElementById('dropdownCreditsExpiry').textContent = `${daysLeft} Days Validity`;
  }
}

async function refreshUserMe() {
  try {
    const res = await api('/api/user-auth/me');
    if (res.ok) {
      const data = await res.safeJson();
      if (data && data.data) updateUserQuotaDisplay(data.data);
    }
  } catch (_) {}
}

async function handleUserSession(user) {
  currentUser = user;

  const displayName = user.fullName || user.username || 'User';
  if (connectUserName) connectUserName.textContent = displayName;
  if (connectUserAvatar) connectUserAvatar.textContent = displayName.charAt(0).toUpperCase();

  // Header Profile trigger details
  if (document.getElementById('headerProfileAvatar')) {
    document.getElementById('headerProfileAvatar').textContent = displayName.charAt(0).toUpperCase();
  }
  if (document.getElementById('headerProfileName')) {
    document.getElementById('headerProfileName').textContent = displayName;
  }
  if (document.getElementById('headerProfileSub')) {
    document.getElementById('headerProfileSub').textContent = `@${user.username}`;
  }

  // Header Profile dropdown details
  if (document.getElementById('dropdownAvatar')) {
    document.getElementById('dropdownAvatar').textContent = displayName.charAt(0).toUpperCase();
  }
  if (document.getElementById('dropdownUserName')) {
    document.getElementById('dropdownUserName').textContent = displayName;
  }
  if (document.getElementById('dropdownUserEmail')) {
    document.getElementById('dropdownUserEmail').textContent = user.email || `${user.username}@workspace`;
  }
  if (document.getElementById('dropdownUserId')) {
    document.getElementById('dropdownUserId').textContent = `User ID: @${user.username}`;
  }

  const welcomeEl = document.getElementById('welcomeUser');
  if (welcomeEl) welcomeEl.textContent = `Signed in as ${displayName} (@${user.username})`;
  if (document.getElementById('sidebarUserName')) {
    document.getElementById('sidebarUserName').textContent = displayName;
  }
  if (document.getElementById('sidebarUserEmail')) {
    document.getElementById('sidebarUserEmail').textContent = user.email || `@${user.username}`;
  }
  if (document.getElementById('sidebarAvatar')) {
    document.getElementById('sidebarAvatar').textContent = displayName.charAt(0).toUpperCase();
  }

  updateUserQuotaDisplay(user);

  const response = await api('/api/user/instances');
  const data = await response.safeJson();
  if (!response.ok || !data.data || !data.data.length) {
    showScreen('connect');
    if (connectStatusBadge) connectStatusBadge.textContent = 'Instance unavailable';
    return;
  }

  myInstance = data.data[0];
  const instNameEl = document.getElementById('instanceName');
  if (instNameEl) instNameEl.textContent = myInstance.name;
  initApiDocsTab(myInstance);
  renderWooCommerceSnippet();

  // Check current WhatsApp connection status
  try {
    const qrRes = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/qr`);
    const qrData = await qrRes.safeJson();
    const isConn = qrRes.ok && qrData.data && qrData.data.isConnected;

    if (isConn) {
      // Already connected -> Open Dashboard directly!
      enterDashboardDirectly(qrData.data);
    } else {
      // Not connected -> Open dedicated Connect Screen first!
      showScreen('connect');
      if (connectPendingView) connectPendingView.classList.remove('hidden');
      if (connectSuccessView) connectSuccessView.classList.add('hidden');
      isRedirectingToDashboard = false;
      refreshQr();
    }
  } catch (err) {
    showScreen('connect');
    refreshQr();
  }
}

function enterDashboardDirectly(info) {
  showScreen('dashboard');
  loadTemplates();
  loadStats();
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

    // Update Dashboard indicators
    const instStatusEl = document.getElementById('instanceStatus');
    if (instStatusEl) {
      instStatusEl.textContent = isConnected
        ? 'Status: CONNECTED'
        : (isAuthenticating ? 'Status: AUTHENTICATING (Syncing...)' : `Status: ${info.status}`);
    }

    const navStatusEl = document.getElementById('userNavStatus');
    if (navStatusEl) {
      navStatusEl.textContent = isConnected
        ? 'WhatsApp Connected'
        : (isAuthenticating ? 'Syncing WhatsApp...' : (info.qrReady ? 'Scan QR to Connect' : 'Preparing WhatsApp'));
    }

    const navBadge = document.getElementById('navDeviceBadge');
    if (navBadge) {
      navBadge.textContent = isConnected ? 'Online' : (info.qrReady ? 'Scan QR' : 'Syncing');
      navBadge.className = isConnected ? 'nav-item-badge success' : (info.qrReady ? 'nav-item-badge highlight' : 'nav-item-badge');
    }
    const engineText = document.getElementById('healthEngineText');
    if (engineText) {
      engineText.textContent = isConnected ? 'Active' : 'Standby';
    }

    // Update Dashboard tab items
    const image = document.getElementById('userQrImage');
    const loader = document.getElementById('userQrLoader');
    const loaderText = document.getElementById('userQrLoaderText');
    const connected = document.getElementById('connectedInfo');
    const appLink = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(myInstance.id)}&access_token=${encodeURIComponent(myInstance.accessToken)}`;

    if (document.getElementById('userAppLinkText')) document.getElementById('userAppLinkText').textContent = appLink;
    document.getElementById('copyUserAppLink')?.classList.toggle('hidden', !isConnected);
    document.getElementById('userAppLinkBox')?.classList.toggle('hidden', !isConnected);
    document.getElementById('userQrSteps')?.classList.toggle('hidden', isConnected);
    document.getElementById('userConnectedVisual')?.classList.toggle('hidden', !isConnected);
    document.getElementById('userQrAutoRefresh')?.classList.toggle('hidden', isConnected);
    document.getElementById('userQrFrame')?.classList.toggle('user-connected-frame', isConnected);

    const userHeroDesc = document.getElementById('userHeroDescription');
    if (userHeroDesc) {
      userHeroDesc.textContent = isConnected
        ? 'Your WhatsApp account is securely connected. You can now send single or bulk messages from this workspace.'
        : (isAuthenticating
            ? 'Mobile scanned! Logging in and synchronizing WhatsApp session, please wait a moment...'
            : 'Connect your personal WhatsApp account securely. This workspace never displays or uses another user\'s WhatsApp session.');
    }

    // Toggle Overview Dashboard vs QR Scan Box
    const overviewConnectedView = document.getElementById('overviewConnectedView');
    const overviewQrSection = document.getElementById('overviewQrSection');

    if (isConnected) {
      if (overviewConnectedView) overviewConnectedView.classList.remove('hidden');
      if (overviewQrSection) overviewQrSection.classList.add('hidden');
      loadDashboardOverview(info);
      if (image) image.classList.add('hidden');
      if (loader) loader.classList.add('hidden');
      if (connected) {
        connected.textContent = `✓ Connected as ${info.pushname || 'WhatsApp user'} ${info.phone ? `(+${info.phone})` : ''}`;
        connected.classList.remove('hidden');
      }
    } else {
      if (overviewConnectedView) overviewConnectedView.classList.add('hidden');
      if (overviewQrSection) overviewQrSection.classList.remove('hidden');
      if (info.qrDataUrl && !isAuthenticating) {
        if (image) { image.src = info.qrDataUrl; image.classList.remove('hidden'); }
        if (loader) loader.classList.add('hidden');
        if (connected) connected.classList.add('hidden');
      } else {
        if (image) image.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
        if (connected) connected.classList.add('hidden');
        if (loaderText) {
          loaderText.textContent = isAuthenticating
            ? (info.loadingPercent ? `Syncing chats (${info.loadingPercent}%)...` : 'Phone connected! Finalizing login & sync...')
            : 'Loading QR Code...';
        }
      }
    }

    // ==========================================
    // ONBOARDING CONNECT SCREEN LOGIC
    // ==========================================
    if (connectStatusBadge) {
      connectStatusBadge.textContent = isConnected
        ? '✓ WhatsApp Connected'
        : (isAuthenticating ? 'Syncing WhatsApp...' : (info.qrReady ? 'Ready for QR Scan' : 'Preparing WhatsApp QR'));
    }

    if (isConnected) {
      // If we are currently on the Connect Screen, show celebratory success and then enter dashboard!
      if (!isRedirectingToDashboard && connectScreen && !connectScreen.classList.contains('hidden')) {
        isRedirectingToDashboard = true;
        if (connectPendingView) connectPendingView.classList.add('hidden');
        if (connectSuccessView) {
          connectSuccessView.classList.remove('hidden');
          if (connectSuccessPushName) connectSuccessPushName.textContent = info.pushname || 'WhatsApp User';
          if (connectSuccessPhoneDetails) connectSuccessPhoneDetails.textContent = info.phone ? `+${info.phone}` : 'Active Session';
        }
        showToast('🎉 WhatsApp Connected Successfully!');

        setTimeout(() => {
          showScreen('dashboard');
          loadTemplates();
          loadStats();
          isRedirectingToDashboard = false;
        }, 1500);
      }
    } else {
      isRedirectingToDashboard = false;
      if (info.qrDataUrl && !isAuthenticating) {
        if (connectQrImage) {
          connectQrImage.src = info.qrDataUrl;
          connectQrImage.classList.remove('hidden');
        }
        if (connectQrLoader) connectQrLoader.classList.add('hidden');
        if (connectQrFooterStatus) connectQrFooterStatus.textContent = 'Scan this QR code with your phone camera';
      } else {
        if (connectQrImage) connectQrImage.classList.add('hidden');
        if (connectQrLoader) connectQrLoader.classList.remove('hidden');
        if (connectQrLoaderText) {
          connectQrLoaderText.textContent = isAuthenticating
            ? (info.loadingPercent ? `Syncing chats (${info.loadingPercent}%)...` : 'Phone connected! Finalizing login & sync...')
            : 'Loading Secure QR Code...';
        }
        if (connectQrFooterStatus) {
          connectQrFooterStatus.textContent = isAuthenticating ? 'Session sync in progress...' : 'Connecting to WhatsApp engine...';
        }
      }
    }
  } catch (error) {
    if (document.getElementById('instanceStatus')) {
      document.getElementById('instanceStatus').textContent = error.message || 'Unable to load your QR code.';
    }
  }
  clearTimeout(pollTimer);
  pollTimer = setTimeout(refreshQr, 2500);
}

// Connect Screen Actions
document.getElementById('connectScreenLogout')?.addEventListener('click', async () => {
  clearTimeout(pollTimer);
  await api('/api/user-auth/logout', { method: 'POST' });
  location.reload();
});

document.getElementById('btnRefreshConnectQr')?.addEventListener('click', () => {
  if (connectQrLoader) connectQrLoader.classList.remove('hidden');
  if (connectQrImage) connectQrImage.classList.add('hidden');
  if (connectQrLoaderText) connectQrLoaderText.textContent = 'Refreshing QR Code...';
  refreshQr();
  showToast('Refreshing QR Code...');
});

document.getElementById('btnForceEnterDashboard')?.addEventListener('click', () => {
  showScreen('dashboard');
  loadTemplates();
  loadStats();
});

document.getElementById('resetMySession')?.addEventListener('click', async () => {
  if (!myInstance || !confirm('Reset your WhatsApp session? You will need to link your phone again.')) return;
  await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/reset`, { method: 'POST' });
  showScreen('connect');
  if (connectPendingView) connectPendingView.classList.remove('hidden');
  if (connectSuccessView) connectSuccessView.classList.add('hidden');
  isRedirectingToDashboard = false;
  refreshQr();
  showToast('WhatsApp session reset. Please scan the QR code to re-link.');
});

document.getElementById('userLogout')?.addEventListener('click', async () => {
  clearTimeout(pollTimer);
  await api('/api/user-auth/logout', { method: 'POST' });
  location.reload();
});

document.getElementById('copyUserAppLink')?.addEventListener('click', async () => {
  if (!myInstance?.id || !myInstance?.accessToken) return;
  const link = `${window.location.origin}${API_BASE_URL}/api/send?number=91XXXXXXXXXX&type=text&message=Hello&instance_id=${encodeURIComponent(myInstance.id)}&access_token=${encodeURIComponent(myInstance.accessToken)}`;
  try {
    await navigator.clipboard.writeText(link);
    document.getElementById('copyUserAppLink').textContent = 'App API Link Copied!';
  } catch (_) {
    alert('Could not copy the app API link.');
  }
  setTimeout(() => {
    document.getElementById('copyUserAppLink').textContent = 'Copy App API Link';
  }, 2000);
});

function setResult(id, message, isError = false) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.classList.remove('hidden');
  element.style.color = isError ? '#fca5a5' : '#a7f3d0';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Standardizes phone numbers to WhatsApp format:
 * - Strips all non-digit characters (+, -, spaces, brackets)
 * - Converts scientific notation if pasted from Excel (e.g. 9.87654E+09)
 * - Removes leading 0 if 11 digits (e.g. 09876543210 -> 9876543210)
 * - Automatically prepends '91' country code if 10 digits (e.g. 9876543210 -> 919876543210)
 * - Preserves existing country code if 11-15 digits
 */
function formatToIndianWhatsAppNumber(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str) return '';

  // Handle scientific notation from Excel (e.g. 9.87654E+09 or 9.19876E+11)
  if (/[eE]\+?/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) str = num.toLocaleString('fullwide', { useGrouping: false });
  }

  // Strip non-digits
  let digits = str.replace(/\D/g, '');
  if (!digits) return '';

  // If 11 digits starting with 0, strip the 0
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // If standard 10-digit mobile number, automatically prefix 91
  if (digits.length === 10) {
    digits = '91' + digits;
  }

  return digits;
}

const userSingleForm = document.getElementById('userSingleForm');
const userSingleMsgInput = document.getElementById('userSingleMessage');
const userSinglePhoneInput = document.getElementById('userSinglePhone');

// Single Message Attachment Handling
let attachedSingleMedia = null;
const userSingleDropzone = document.getElementById('userSingleDropzone');
const userSingleImageFile = document.getElementById('userSingleImageFile');
const userSingleDropPrompt = document.getElementById('userSingleDropPrompt');
const userSingleAttachPreview = document.getElementById('userSingleAttachPreview');
const userSingleThumb = document.getElementById('userSingleThumb');
const userSingleAttachName = document.getElementById('userSingleAttachName');
const userSingleAttachSize = document.getElementById('userSingleAttachSize');
const userSingleRemoveImg = document.getElementById('userSingleRemoveImg');
const phoneWaImgWrap = document.getElementById('phoneWaImgWrap');
const phoneWaImg = document.getElementById('phoneWaImg');

function clearSingleAttachment() {
  attachedSingleMedia = null;
  if (userSingleImageFile) userSingleImageFile.value = '';
  if (userSingleAttachPreview) userSingleAttachPreview.classList.add('hidden');
  if (userSingleDropPrompt) userSingleDropPrompt.classList.remove('hidden');
  if (phoneWaImgWrap) phoneWaImgWrap.classList.add('hidden');
  if (phoneWaImg) phoneWaImg.src = '';
}

function processUploadedImageFile(file, callback) {
  if (!file) return;
  const isWebp = (file.type && file.type.includes('webp')) || /\.webp$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (isWebp) {
      // WhatsApp Web treats WebP files as stickers which cannot have captions.
      // Convert WebP to JPEG via HTML5 Canvas so the caption text is sent and displayed with the photo.
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 800;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const cleanName = file.name.replace(/\.webp$/i, '');
          const newName = (cleanName.endsWith('.jpg') || cleanName.endsWith('.jpeg')) ? cleanName : `${cleanName}.jpg`;
          const estSize = Math.round((jpegDataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
          callback({
            data: jpegDataUrl,
            name: newName,
            size: estSize,
            mime: 'image/jpeg'
          });
        } catch (_) {
          callback({
            data: dataUrl,
            name: file.name,
            size: file.size,
            mime: file.type || 'image/jpeg'
          });
        }
      };
      img.onerror = () => {
        callback({
          data: dataUrl,
          name: file.name,
          size: file.size,
          mime: file.type || 'image/jpeg'
        });
      };
      img.src = dataUrl;
    } else {
      callback({
        data: dataUrl,
        name: file.name,
        size: file.size,
        mime: file.type || 'image/jpeg'
      });
    }
  };
  reader.readAsDataURL(file);
}

function handleSingleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    alert('Image size exceeds 15MB limit. Please choose a smaller image.');
    return;
  }
  processUploadedImageFile(file, (processed) => {
    attachedSingleMedia = processed;
    if (userSingleThumb) userSingleThumb.src = processed.data;
    if (userSingleAttachName) userSingleAttachName.textContent = processed.name;
    if (userSingleAttachSize) userSingleAttachSize.textContent = formatFileSize(processed.size);
    if (userSingleDropPrompt) userSingleDropPrompt.classList.add('hidden');
    if (userSingleAttachPreview) userSingleAttachPreview.classList.remove('hidden');

    if (phoneWaImg) phoneWaImg.src = processed.data;
    if (phoneWaImgWrap) phoneWaImgWrap.classList.remove('hidden');
    updateSinglePreview();
  });
}

if (userSingleDropzone && userSingleImageFile) {
  userSingleDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#userSingleRemoveImg')) return;
    userSingleImageFile.click();
  });

  userSingleImageFile.addEventListener('change', () => {
    if (userSingleImageFile.files?.[0]) {
      handleSingleFile(userSingleImageFile.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    userSingleDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      userSingleDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    userSingleDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      userSingleDropzone.classList.remove('dragover');
    });
  });

  userSingleDropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSingleFile(file);
  });

  userSingleRemoveImg?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSingleAttachment();
  });
}

function updateSinglePreview() {
  const preview = document.getElementById('userSinglePreview');
  const previewTime = document.getElementById('userSinglePreviewTime');
  const charBadge = document.getElementById('userSingleCharBadge');
  const text = userSingleMsgInput ? userSingleMsgInput.value : '';

  if (charBadge) charBadge.textContent = `${text.length} Chars`;
  if (preview) {
    if (text.trim()) {
      preview.textContent = text;
      preview.classList.remove('hidden');
    } else if (attachedSingleMedia) {
      preview.textContent = '';
      preview.classList.add('hidden');
    } else {
      preview.textContent = 'Type message to preview...';
      preview.classList.remove('hidden');
    }
  }
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

// Single Message Phone Number Auto-Prefix 91
const userSinglePhoneEl = document.getElementById('userSinglePhone');
userSinglePhoneEl?.addEventListener('blur', () => {
  if (userSinglePhoneEl.value) {
    const formatted = formatToIndianWhatsAppNumber(userSinglePhoneEl.value);
    if (formatted) userSinglePhoneEl.value = formatted;
  }
});
userSinglePhoneEl?.addEventListener('paste', () => {
  setTimeout(() => {
    if (userSinglePhoneEl.value) {
      const formatted = formatToIndianWhatsAppNumber(userSinglePhoneEl.value);
      if (formatted) userSinglePhoneEl.value = formatted;
    }
  }, 30);
});

if (userSingleForm) {
  userSingleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rawPhone = document.getElementById('userSinglePhone').value.trim();
    const phone = formatToIndianWhatsAppNumber(rawPhone);
    if (document.getElementById('userSinglePhone') && phone) {
      document.getElementById('userSinglePhone').value = phone;
    }
    const message = document.getElementById('userSingleMessage').value.trim();

    if (!phone) {
      return setResult('userSingleResult', 'Please enter a recipient phone number.', true);
    }
    if (!message && !attachedSingleMedia) {
      return setResult('userSingleResult', 'Please enter a message or attach an image.', true);
    }

    const button = document.getElementById('userSendSingle');
    button.disabled = true;
    try {
      const payload = {
        phoneNumber: phone,
        message: message
      };
      if (attachedSingleMedia) {
        payload.media = attachedSingleMedia.data;
        payload.filename = attachedSingleMedia.name;
        payload.mimetype = attachedSingleMedia.mime;
        payload.caption = message;
      }

      const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.safeJson();
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      setResult('userSingleResult', attachedSingleMedia ? 'Image and message sent successfully.' : 'Message sent successfully.');
      showToast('WhatsApp message sent successfully!');
      refreshUserMe();
      event.target.reset();
      clearSingleAttachment();
      updateSinglePreview();
      const recipient = document.getElementById('previewRecipientName');
      if (recipient) recipient.textContent = 'Recipient';
    } catch (error) {
      setResult('userSingleResult', error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

const userBulkForm = document.getElementById('userBulkForm');
const userBulkNumbers = document.getElementById('userBulkNumbers');
const userBulkMessage = document.getElementById('userBulkMessage');
const userDelayRange = document.getElementById('userDelayRange');

// Bulk Message Attachment Handling
let attachedBulkMedia = null;
const userBulkDropzone = document.getElementById('userBulkDropzone');
const userBulkImageFile = document.getElementById('userBulkImageFile');
const userBulkDropPrompt = document.getElementById('userBulkDropPrompt');
const userBulkAttachPreview = document.getElementById('userBulkAttachPreview');
const userBulkThumb = document.getElementById('userBulkThumb');
const userBulkAttachName = document.getElementById('userBulkAttachName');
const userBulkAttachSize = document.getElementById('userBulkAttachSize');
const userBulkRemoveImg = document.getElementById('userBulkRemoveImg');
const userBulkPreviewImgWrap = document.getElementById('userBulkPreviewImgWrap');
const userBulkPreviewImg = document.getElementById('userBulkPreviewImg');

function clearBulkAttachment() {
  attachedBulkMedia = null;
  if (userBulkImageFile) userBulkImageFile.value = '';
  if (userBulkAttachPreview) userBulkAttachPreview.classList.add('hidden');
  if (userBulkDropPrompt) userBulkDropPrompt.classList.remove('hidden');
  if (userBulkPreviewImgWrap) userBulkPreviewImgWrap.classList.add('hidden');
  if (userBulkPreviewImg) userBulkPreviewImg.src = '';
}

function handleBulkFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    alert('Image size exceeds 15MB limit. Please choose a smaller image.');
    return;
  }
  processUploadedImageFile(file, (processed) => {
    attachedBulkMedia = processed;
    if (userBulkThumb) userBulkThumb.src = processed.data;
    if (userBulkAttachName) userBulkAttachName.textContent = processed.name;
    if (userBulkAttachSize) userBulkAttachSize.textContent = formatFileSize(processed.size);
    if (userBulkDropPrompt) userBulkDropPrompt.classList.add('hidden');
    if (userBulkAttachPreview) userBulkAttachPreview.classList.remove('hidden');

    if (userBulkPreviewImg) userBulkPreviewImg.src = processed.data;
    if (userBulkPreviewImgWrap) userBulkPreviewImgWrap.classList.remove('hidden');
    updateUserBulkCounts();
  });
}

if (userBulkDropzone && userBulkImageFile) {
  userBulkDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#userBulkRemoveImg')) return;
    userBulkImageFile.click();
  });

  userBulkImageFile.addEventListener('change', () => {
    if (userBulkImageFile.files?.[0]) {
      handleBulkFile(userBulkImageFile.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    userBulkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      userBulkDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    userBulkDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      userBulkDropzone.classList.remove('dragover');
    });
  });

  userBulkDropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleBulkFile(file);
  });

  userBulkRemoveImg?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearBulkAttachment();
  });
}

let isUserBulkSending = false;
let shouldStopUserBulk = false;

if (userBulkForm && userBulkNumbers && userBulkMessage && userDelayRange) {
  function parseUserNumbers() {
    return userBulkNumbers.value
      .split(/[\r\n,\s;]+/)
      .map(formatToIndianWhatsAppNumber)
      .filter((value, index, list) => value && value.length >= 10 && value.length <= 15 && list.indexOf(value) === index)
      .slice(0, 1000);
  }

  function autoFormatBulkTextarea() {
    if (!userBulkNumbers) return;
    const lines = userBulkNumbers.value.split(/[\r\n,;]+/);
    const formatted = [];
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const clean = formatToIndianWhatsAppNumber(trimmed);
      formatted.push(clean || trimmed);
    }
    if (formatted.length > 0) {
      userBulkNumbers.value = formatted.join('\n');
      updateUserBulkCounts();
    }
  }

  // Auto-prefix 91 on blur or paste in Bulk Numbers textarea
  userBulkNumbers.addEventListener('blur', autoFormatBulkTextarea);
  userBulkNumbers.addEventListener('paste', () => {
    setTimeout(autoFormatBulkTextarea, 50);
  });

  document.getElementById('btnAutoFormat91')?.addEventListener('click', () => {
    autoFormatBulkTextarea();
    const count = parseUserNumbers().length;
    showToast(`⚡ ${count} number${count === 1 ? '' : 's'} verified with 91 country code prefix!`);
  });

  // Excel (.xlsx, .xls) and CSV file upload handling
  const excelFileInput = document.getElementById('userBulkExcelFile');
  const btnUploadExcel = document.getElementById('btnUploadExcel');
  const bulkFileInfo = document.getElementById('bulkExcelFileInfo');
  const bulkFileName = document.getElementById('bulkExcelFileName');
  const btnClearFile = document.getElementById('btnClearUploadedFile');

  btnUploadExcel?.addEventListener('click', () => {
    excelFileInput?.click();
  });

  btnClearFile?.addEventListener('click', () => {
    if (excelFileInput) excelFileInput.value = '';
    if (bulkFileInfo) bulkFileInfo.classList.add('hidden');
  });

  excelFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name;
    const isCsv = /\.csv$/i.test(name) || file.type === 'text/csv';
    const isExcel = /\.(xlsx|xls)$/i.test(name);

    if (!isCsv && !isExcel) {
      showToast('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.', 'error');
      return;
    }

    showToast(`Reading ${name}...`);

    try {
      const extractedNumbers = [];

      if (isExcel) {
        if (typeof XLSX === 'undefined') {
          throw new Error('Excel parser is initializing. If offline, please save spreadsheet as .csv.');
        }
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          for (const row of rows) {
            if (!Array.isArray(row)) continue;
            for (const cell of row) {
              const formatted = formatToIndianWhatsAppNumber(cell);
              if (formatted && formatted.length >= 10 && formatted.length <= 15) {
                extractedNumbers.push(formatted);
              }
            }
          }
        }
      } else {
        // Plain CSV text parsing (works offline with zero external dependencies)
        const text = await file.text();
        const lines = text.split(/[\r\n]+/);
        for (const line of lines) {
          const cells = line.split(/[,;\t]+/);
          for (const cell of cells) {
            const formatted = formatToIndianWhatsAppNumber(cell);
            if (formatted && formatted.length >= 10 && formatted.length <= 15) {
              extractedNumbers.push(formatted);
            }
          }
        }
      }

      // De-duplicate while preserving order
      const uniqueList = [...new Set(extractedNumbers)];

      if (uniqueList.length === 0) {
        showToast(`No valid 10-15 digit phone numbers found in ${name}. Check mobile column.`, 'error');
        return;
      }

      // Merge into textarea
      const current = userBulkNumbers.value.trim();
      if (current) {
        const currentList = current.split(/[\r\n,\s;]+/).map(formatToIndianWhatsAppNumber).filter(Boolean);
        const merged = [...new Set([...currentList, ...uniqueList])];
        userBulkNumbers.value = merged.join('\n');
      } else {
        userBulkNumbers.value = uniqueList.join('\n');
      }

      updateUserBulkCounts();

      if (bulkFileInfo && bulkFileName) {
        bulkFileName.textContent = `📄 ${name} (${uniqueList.length} contacts loaded with 91)`;
        bulkFileInfo.classList.remove('hidden');
      }

      showToast(`✅ Successfully imported ${uniqueList.length} numbers from ${name} with 91 prefix!`);
    } catch (err) {
      console.error('File parsing error:', err);
      showToast(err.message || 'Error reading spreadsheet file.', 'error');
    }
  });

  function updateUserBulkCounts() {
    const numbers = parseUserNumbers();
    document.getElementById('userNumberCountBadge').textContent = `${numbers.length} Number${numbers.length === 1 ? '' : 's'}`;
    document.getElementById('userCharCountBadge').textContent = `${userBulkMessage.value.length} Chars`;
    const preview = document.getElementById('userBulkPreview');
    const previewTime = document.getElementById('userBulkPreviewTime');
    const text = userBulkMessage.value.trim();
    if (preview) {
      if (text) {
        preview.textContent = text;
        preview.classList.remove('hidden');
      } else if (attachedBulkMedia) {
        preview.textContent = '';
        preview.classList.add('hidden');
      } else {
        preview.textContent = 'Type message to preview...';
        preview.classList.remove('hidden');
      }
    }
    if (previewTime) {
      previewTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  function updateUserDelay() {
    const delay = parseFloat(userDelayRange.value) || 4.5;
    document.getElementById('userSliderVal').textContent = `${delay.toFixed(1)}s`;
    const minSec = Math.max(0.5, delay - 0.5).toFixed(1).replace('.0', '');
    const maxSec = (delay + 0.5).toFixed(1).replace('.0', '');
    document.getElementById('userDelayDisplay').textContent = `${minSec} - ${maxSec} Seconds`;

    // Highlight active preset button if matched
    document.querySelectorAll('[data-speed]').forEach(chip => {
      const chipSpeed = parseFloat(chip.dataset.speed);
      if (Math.abs(chipSpeed - delay) < 0.1) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // Quick Speed Presets click handlers
  document.querySelectorAll('[data-speed]').forEach(chip => {
    chip.addEventListener('click', () => {
      const spd = parseFloat(chip.dataset.speed);
      if (spd && userDelayRange) {
        userDelayRange.value = spd;
        updateUserDelay();
      }
    });
  });

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
  document.getElementById('userClearLog')?.addEventListener('click', () => {
    document.getElementById('userLogTableBody').innerHTML = '<tr class="empty-row"><td colspan="4">No messages sent yet. Add numbers and click Start Sending.</td></tr>';
    updateUserBulkProgress(0, 0, 0, 0);
  });

  document.querySelectorAll('[data-user-fmt]').forEach((button) => button.addEventListener('click', () => {
    const marks = { bold: '*', italic: '_', strike: '~', mono: '```' };
    const mark = marks[button.dataset.userFmt];
    const start = userBulkMessage.selectionStart;
    const end = userBulkMessage.selectionEnd;
    const selected = userBulkMessage.value.slice(start, end) || 'text';
    userBulkMessage.setRangeText(`${mark}${selected}${mark}`, start, end, 'end');
    userBulkMessage.focus();
    updateUserBulkCounts();
  }));

  userBulkForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isUserBulkSending) return;

    if (!myInstance?.id) {
      return setResult('userBulkResult', 'WhatsApp instance not found. Please refresh the page.', true);
    }

    const phoneNumbers = parseUserNumbers();
    const message = userBulkMessage.value.trim();

    if (!phoneNumbers.length) {
      return setResult('userBulkResult', 'Add at least one valid recipient number (min 10 digits).', true);
    }
    if (!message && !attachedBulkMedia) {
      return setResult('userBulkResult', 'Please enter a message or attach an image.', true);
    }

    isUserBulkSending = true;
    shouldStopUserBulk = false;

    const btnStart = document.getElementById('userSendBulk');
    const btnStop = document.getElementById('userStopBulk');
    const state = document.getElementById('userExecStateBadge');
    const countdownBanner = document.getElementById('userCountdownBanner');
    const countdownText = document.getElementById('userCountdownText');

    btnStart.classList.add('hidden');
    if (btnStop) {
      btnStop.classList.remove('hidden');
      btnStop.textContent = '⏹ Stop Sending';
      btnStop.disabled = false;
    }

    state.className = 'badge badge-running';
    state.textContent = 'Sending...';

    const total = phoneNumbers.length;
    let sentCount = 0;
    let failedCount = 0;

    updateUserBulkProgress(0, total, 0, 0);

    // Initialize delivery log table rows
    const logBody = document.getElementById('userLogTableBody');
    logBody.innerHTML = phoneNumbers.map((number, index) => `
      <tr id="userBulkRow-${index}">
        <td>${index + 1}</td>
        <td><strong>+${number}</strong></td>
        <td><span class="tag-pending">Queued</span></td>
        <td>Waiting in queue</td>
      </tr>
    `).join('');

    for (let i = 0; i < total; i++) {
      if (shouldStopUserBulk) {
        // Mark all remaining rows as cancelled
        for (let rem = i; rem < total; rem++) {
          const remRow = document.getElementById(`userBulkRow-${rem}`);
          if (remRow) {
            remRow.children[2].innerHTML = '<span class="text-muted">Cancelled</span>';
            remRow.children[3].textContent = 'Stopped by user';
          }
        }
        break;
      }

      const phone = phoneNumbers[i];
      const row = document.getElementById(`userBulkRow-${i}`);
      if (row) {
        row.children[2].innerHTML = '<span class="tag-sending">Sending...</span>';
        row.children[3].textContent = 'Connecting to WhatsApp...';
      }

      state.textContent = `Sending ${i + 1}/${total}...`;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        const payload = {
          phoneNumber: phone,
          message: message
        };
        if (attachedBulkMedia) {
          payload.media = attachedBulkMedia.data;
          payload.filename = attachedBulkMedia.name;
          payload.mimetype = attachedBulkMedia.mime;
          payload.caption = message;
        }

        const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.safeJson();

        if (response.ok && data.success) {
          sentCount++;
          if (row) {
            row.children[2].innerHTML = '<span class="tag-sent">✓ Sent</span>';
            row.children[3].textContent = `${attachedBulkMedia ? 'Photo + Caption' : 'Message'} Delivered (${timeStr})`;
          }
        } else {
          failedCount++;
          if (row) {
            row.children[2].innerHTML = '<span class="tag-failed">✕ Failed</span>';
            row.children[3].textContent = data.error || 'Failed to send';
          }
        }
      } catch (err) {
        failedCount++;
        if (row) {
          row.children[2].innerHTML = '<span class="tag-failed">✕ Error</span>';
          row.children[3].textContent = err.message || 'Network error';
        }
      }

      updateUserBulkProgress(i + 1, total, sentCount, failedCount);

      // If more numbers remaining and user hasn't stopped, execute the real Anti-Ban delay countdown!
      if (i < total - 1 && !shouldStopUserBulk) {
        const baseDelaySec = parseFloat(userDelayRange.value) || 4.5;
        // Jitter: e.g. baseDelay ± 0.4s (min 0.8s)
        const jitterSec = Math.max(0.8, baseDelaySec + ((Math.random() * 0.8) - 0.4));
        const totalWaitMs = Math.round(jitterSec * 1000);
        const startTime = Date.now();

        if (countdownBanner) countdownBanner.classList.remove('hidden');

        // Update the next row to indicate waiting
        const nextRow = document.getElementById(`userBulkRow-${i + 1}`);
        if (nextRow) {
          nextRow.children[3].textContent = 'Next in queue (waiting delay)...';
        }

        while ((Date.now() - startTime) < totalWaitMs && !shouldStopUserBulk) {
          const remainingSec = Math.max(0, (totalWaitMs - (Date.now() - startTime)) / 1000);
          if (countdownText) {
            countdownText.textContent = `⏳ Waiting ${remainingSec.toFixed(1)}s (Anti-Ban safety delay before next message)...`;
          }
          state.textContent = `Delay: ${remainingSec.toFixed(1)}s...`;
          await new Promise((r) => setTimeout(r, 100));
        }

        if (countdownBanner) countdownBanner.classList.add('hidden');
      }
    }

    // Finished or Stopped
    if (countdownBanner) countdownBanner.classList.add('hidden');
    isUserBulkSending = false;
    btnStart.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');

    if (shouldStopUserBulk) {
      state.className = 'badge badge-stopped';
      state.textContent = 'Stopped';
      setResult('userBulkResult', `Sending stopped: ${sentCount} sent, ${failedCount} failed, ${total - (sentCount + failedCount)} cancelled.`, true);
    } else {
      state.className = 'badge badge-completed';
      state.textContent = 'Completed';
      setResult('userBulkResult', `Bulk dispatch completed: ${sentCount}/${total} delivered successfully!`);
      showToast(`Bulk broadcast completed: ${sentCount}/${total} delivered!`);
      refreshUserMe();
    }
  });

  document.getElementById('userStopBulk')?.addEventListener('click', () => {
    if (isUserBulkSending) {
      shouldStopUserBulk = true;
      const btnStop = document.getElementById('userStopBulk');
      if (btnStop) {
        btnStop.textContent = 'Stopping...';
        btnStop.disabled = true;
      }
    }
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
      code: `' VB.NET WhatsApp API Integration (Text + Optional Image)
Dim strMobileNo As String = "919876543210"
Dim strMessage As String = "Hello! Your invoice #1042 has been generated."
Dim strMediaUrl As String = "https://example.com/invoice.jpg" ' Optional image
Dim strInstance As String = "${id}"
Dim strToken As String = "${token}"

Dim requestUrl As String = "${origin}/api/send?number=" & strMobileNo & "&type=text&message=" & Uri.EscapeDataString(strMessage) & "&media_url=" & Uri.EscapeDataString(strMediaUrl) & "&instance_id=" & strInstance & "&access_token=" & strToken

Dim client As New System.Net.WebClient()
Dim response As String = client.DownloadString(requestUrl)
Console.WriteLine(response)`
    },
    csharp: {
      title: 'C# .NET (Console / ASP.NET / Desktop)',
      code: `// C# .NET WhatsApp API Integration (Text + Optional Image)
using System;
using System.Net.Http;
using System.Threading.Tasks;

using var client = new HttpClient();
string mobileNo = "919876543210";
string message = "Hello! Your invoice #1042 has been generated.";
string mediaUrl = "https://example.com/invoice.jpg"; // Optional image
string instanceId = "${id}";
string accessToken = "${token}";

string url = $"${origin}/api/send?number={mobileNo}&type=text&message={Uri.EscapeDataString(message)}&media_url={Uri.EscapeDataString(mediaUrl)}&instance_id={instanceId}&access_token={accessToken}";

string response = await client.GetStringAsync(url);
Console.WriteLine(response);`
    },
    php: {
      title: 'PHP (cURL / file_get_contents)',
      code: `<?php
// PHP WhatsApp API Integration (Text + Optional Image)
$baseUrl = "${origin}/api/send";
$params = [
    'number'       => '919876543210',
    'type'         => 'text',
    'message'      => 'Hello! Your invoice #1042 has been generated.',
    'media_url'    => 'https://example.com/invoice.jpg', // Optional image URL
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
      code: `# Python WhatsApp API Integration (Text + Optional Image)
import requests

url = "${origin}/api/send"
params = {
    "number": "919876543210",
    "type": "text",
    "message": "Hello! Your invoice #1042 has been generated.",
    "media_url": "https://example.com/invoice.jpg", # Optional image URL
    "instance_id": "${id}",
    "access_token": "${token}"
}

response = requests.get(url, params=params)
print(response.json())`
    },
    curl: {
      title: 'cURL (Terminal / Command Line)',
      code: `# cURL Terminal Command (Text + Optional Image)
curl -X GET "${origin}/api/send?number=919876543210&type=text&message=Hello+from+API&media_url=https://example.com/invoice.jpg&instance_id=${id}&access_token=${token}"`
    },
    js: {
      title: 'JavaScript / Node.js (fetch API)',
      code: `// Node.js / Modern JavaScript (Text + Optional Image)
const params = new URLSearchParams({
  number: '919876543210',
  type: 'text',
  message: 'Hello! Your invoice #1042 has been generated.',
  media_url: 'https://example.com/invoice.jpg', // Optional image URL
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
      if (data && data.data) handleUserSession(data.data);
    }
  } catch (_) {}
})();

/* ==========================================================================
   SaaS Add-on Logic: Templates, Analytics, Logs & WooCommerce Integrations
   ========================================================================== */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Mobile sidebar drawer toggle
document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => {
  const sb = document.getElementById('workspaceSidebar') || document.getElementById('workspaceSidebarRight');
  sb?.classList.toggle('mobile-open');
});

// ==========================================================================
// Dashboard Overview (Tab 1) Operational Logic
// ==========================================================================
async function loadDashboardOverview(info) {
  const nameEl = document.getElementById('dashConnectedName');
  if (nameEl) nameEl.textContent = (info && info.pushname) || currentUser?.fullName || 'WhatsApp Account';

  const phoneEl = document.getElementById('dashConnectedPhone');
  if (phoneEl) {
    phoneEl.textContent = (info && info.phone) ? `+${info.phone} • Active Multi-Device Session` : 'Active WhatsApp Session';
  }

  // Update KPI cards
  try {
    const statsRes = await api('/api/user/stats');
    const statsData = await statsRes.safeJson();
    if (statsRes.ok && statsData.data) {
      const stats = statsData.data;
      if (document.getElementById('dashKpiSentToday')) document.getElementById('dashKpiSentToday').textContent = stats.sentToday.toLocaleString();
      if (document.getElementById('dashKpiSuccessRate')) document.getElementById('dashKpiSuccessRate').textContent = `${stats.successRate}%`;
      if (document.getElementById('dashKpiTotalSent')) document.getElementById('dashKpiTotalSent').textContent = stats.totalDispatched.toLocaleString();
    }
  } catch (_) {}

  // Update credits KPI
  if (currentUser && document.getElementById('dashKpiCredits')) {
    const quota = currentUser.messageQuota || 2500;
    const remaining = typeof currentUser.creditsRemaining === 'number' ? currentUser.creditsRemaining : (quota - (currentUser.messagesUsed || 0));
    document.getElementById('dashKpiCredits').textContent = `${remaining.toLocaleString()} / ${quota.toLocaleString()}`;
  }

  // Load recent 5 logs
  const logsTbody = document.getElementById('dashRecentLogsBody');
  if (logsTbody) {
    try {
      const logsRes = await api('/api/user/logs?limit=5');
      const logsData = await logsRes.safeJson();
      const logs = (logsRes.ok && logsData.data) ? logsData.data : [];
      if (logs.length === 0) {
        logsTbody.innerHTML = '<tr><td colspan="5" class="text-secondary" style="text-align:center; padding:2.5rem 1rem;">No messages sent yet. Use Quick Actions above to dispatch your first message.</td></tr>';
      } else {
        logsTbody.innerHTML = logs.map(l => {
          const isSent = l.status === 'sent';
          const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
          return `
            <tr>
              <td class="dispatch-time-cell">${time}</td>
              <td>
                <span class="dispatch-recipient-badge">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  +${escapeHtml(l.recipient)}
                </span>
              </td>
              <td><span class="dispatch-type-badge">${escapeHtml(l.type || 'direct')}</span></td>
              <td>
                <div class="dispatch-msg-snippet" title="${escapeHtml(l.preview || '')}">${escapeHtml(l.preview || '-')}</div>
              </td>
              <td>
                <span class="dispatch-status-pill ${isSent ? 'sent' : 'failed'}">
                  ${isSent ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Sent' : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Failed'}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (_) {
      logsTbody.innerHTML = '<tr><td colspan="5" class="text-secondary" style="text-align:center; padding:2rem 1rem;">Could not load recent logs.</td></tr>';
    }
  }
}

// Dashboard Overview Sync & Disconnect buttons
document.getElementById('btnDashSyncSession')?.addEventListener('click', async () => {
  showToast('Synchronizing WhatsApp session...');
  await refreshQr();
  if (myInstance) loadDashboardOverview(myInstance);
});

document.getElementById('btnDashDisconnect')?.addEventListener('click', async () => {
  document.getElementById('btnSettingsDisconnect')?.click();
});

// ==========================================================================
// Plans & Credit Recharge Page (Razorpay Integration)
// ==========================================================================
function loadPlansPage() {
  const u = currentUser;
  if (!u) return;

  const quota = u.messageQuota || 2500;
  const remaining = typeof u.creditsRemaining === 'number' ? u.creditsRemaining : (quota - (u.messagesUsed || 0));
  const planTagEl = document.getElementById('plansPageCurrentTag');
  const creditsEl = document.getElementById('plansPageCurrentCredits');
  const expiryEl = document.getElementById('plansPageCurrentExpiry');

  if (planTagEl) planTagEl.textContent = `⚡ ${(u.plan || 'PRO SAAS PLAN').toUpperCase()}`;
  if (creditsEl) creditsEl.textContent = `${remaining.toLocaleString()} / ${quota.toLocaleString()} Available`;
  if (expiryEl && u.planExpiresAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(u.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
    expiryEl.textContent = `${daysLeft} Days Validity`;
  }
}

// Sidebar Recharge / Upgrade Button switches directly to Plans Tab
document.getElementById('btnUpgradePlan')?.addEventListener('click', () => {
  document.querySelector('[data-user-tab="plansTab"]')?.click();
});

// Tab toggle: Monthly Plans vs Top-Up Packs on Plans Page
document.getElementById('plansPageTabMonthly')?.addEventListener('click', () => {
  document.getElementById('plansPageTabMonthly')?.classList.add('active');
  document.getElementById('plansPageTabTopup')?.classList.remove('active');
  document.getElementById('plansPageSectionMonthly')?.classList.remove('hidden');
  document.getElementById('plansPageSectionTopup')?.classList.add('hidden');
});

document.getElementById('plansPageTabTopup')?.addEventListener('click', () => {
  document.getElementById('plansPageTabTopup')?.classList.add('active');
  document.getElementById('plansPageTabMonthly')?.classList.remove('active');
  document.getElementById('plansPageSectionTopup')?.classList.remove('hidden');
  document.getElementById('plansPageSectionMonthly')?.classList.add('hidden');
});

// Razorpay Checkout Integration
document.querySelectorAll('.btn-razorpay-pay').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const planId = btn.dataset.plan;
    const planName = btn.dataset.name;
    const originalHtml = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Contacting Razorpay...</span>';

    try {
      const orderRes = await api('/api/user/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const orderData = await orderRes.safeJson();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initialize payment order.');
      }

      if (typeof window.Razorpay === 'function') {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Pixano Connect',
          description: orderData.plan?.name || planName,
          order_id: orderData.isMockOrder ? undefined : orderData.orderId,
          prefill: {
            name: currentUser?.fullName || '',
            email: currentUser?.email || '',
            contact: currentUser?.phone || ''
          },
          theme: {
            color: '#00a884'
          },
          handler: async function (response) {
            btn.innerHTML = '<span>Verifying Payment...</span>';
            try {
              const verifyRes = await api('/api/user/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderData.orderId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planId
                })
              });
              const verifyData = await verifyRes.safeJson();
              if (verifyRes.ok) {
                showToast(`🎉 ${verifyData.message || 'Payment verified! Plan activated.'}`);
                await refreshUserMe();
                loadPlansPage();
              } else {
                showToast(verifyData.error || 'Payment verification failed.', 'error');
              }
            } catch (verErr) {
              showToast('Payment verification error: ' + verErr.message, 'error');
            } finally {
              btn.disabled = false;
              btn.innerHTML = originalHtml;
            }
          },
          modal: {
            ondismiss: function () {
              btn.disabled = false;
              btn.innerHTML = originalHtml;
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          showToast(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`, 'error');
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        });
        rzp.open();
      } else {
        // Fallback test mode if external Razorpay CDN was unreachable
        const proceedSim = confirm(`Razorpay SDK running in sandbox mode. Would you like to activate ${planName} in instant test mode?`);
        if (proceedSim) {
          await triggerSimulationPayment(planId, btn, originalHtml);
        } else {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    } catch (err) {
      showToast(err.message || 'Payment initiation error', 'error');
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });
});

// Instant Test Simulation Activation
async function triggerSimulationPayment(planId, btn, originalHtml) {
  try {
    const res = await api('/api/user/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, isSimulation: true })
    });
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to activate plan.');
    showToast(`🎉 ${data.message || 'Plan activated successfully!'}`);
    await refreshUserMe();
    loadPlansPage();
  } catch (e) {
    showToast(e.message || 'Activation failed', 'error');
  } finally {
    if (btn && originalHtml) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

document.querySelectorAll('.btn-sim-pay').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const planId = btn.dataset.plan;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Activating...</span>';
    await triggerSimulationPayment(planId, btn, originalText);
  });
});

// ==========================================================================
// Account Settings Page Logic
// ==========================================================================
function loadSettingsPage() {
  if (!currentUser) return;
  const fullNameInp = document.getElementById('settingsFullName');
  const usernameInp = document.getElementById('settingsUsername');
  const emailInp = document.getElementById('settingsEmail');

  if (fullNameInp) fullNameInp.value = currentUser.fullName || '';
  if (usernameInp) usernameInp.value = currentUser.username || '';
  if (emailInp) emailInp.value = currentUser.email || '';

  // Update session info
  const phoneVal = document.getElementById('settingsPhoneVal');
  const pushnameVal = document.getElementById('settingsPushnameVal');
  const instanceIdVal = document.getElementById('settingsInstanceIdVal');
  const statusPill = document.getElementById('settingsConnStatusPill');

  if (instanceIdVal && myInstance) {
    instanceIdVal.textContent = myInstance.id;
  }
  if (myInstance && myInstance.phone && phoneVal) {
    phoneVal.textContent = `+${myInstance.phone}`;
  }
  if (myInstance && myInstance.pushname && pushnameVal) {
    pushnameVal.textContent = myInstance.pushname;
  }
  if (statusPill && myInstance) {
    statusPill.textContent = myInstance.isConnected ? '● Connected' : '● Disconnected';
    statusPill.className = myInstance.isConnected ? 'status-pill status-connected' : 'status-pill status-disconnected';
  }
}

// Save Profile form handler
document.getElementById('formUserProfile')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('profileErrorMsg');
  if (errorBox) errorBox.classList.add('hidden');

  const fullName = document.getElementById('settingsFullName')?.value.trim();
  const username = document.getElementById('settingsUsername')?.value.trim();
  const email = document.getElementById('settingsEmail')?.value.trim();

  const btn = document.getElementById('btnSaveProfile');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving Profile...';
  }

  try {
    const res = await api('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, email })
    });
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

    showToast('Profile credentials updated successfully!');
    if (data.user) {
      currentUser = data.user;
      const displayName = currentUser.fullName || currentUser.username;
      if (document.getElementById('welcomeUser')) document.getElementById('welcomeUser').textContent = `Signed in as ${displayName} (@${currentUser.username})`;
      if (document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').textContent = displayName;
      if (document.getElementById('sidebarUserEmail')) document.getElementById('sidebarUserEmail').textContent = currentUser.email;
    }
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save Profile Changes';
    }
  }
});

// Change Password form handler
document.getElementById('formChangePassword')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('passwordErrorMsg');
  if (errorBox) errorBox.classList.add('hidden');

  const currentPassword = document.getElementById('settingsCurrentPassword')?.value;
  const newPassword = document.getElementById('settingsNewPassword')?.value;
  const confirmPassword = document.getElementById('settingsConfirmPassword')?.value;

  if (newPassword !== confirmPassword) {
    if (errorBox) {
      errorBox.textContent = 'New password and confirm password do not match.';
      errorBox.classList.remove('hidden');
    }
    return;
  }

  const btn = document.getElementById('btnSavePassword');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating Password...';
  }

  try {
    const res = await api('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to change password.');

    showToast('Password updated successfully! Please keep your credentials secure.');
    if (document.getElementById('settingsCurrentPassword')) document.getElementById('settingsCurrentPassword').value = '';
    if (document.getElementById('settingsNewPassword')) document.getElementById('settingsNewPassword').value = '';
    if (document.getElementById('settingsConfirmPassword')) document.getElementById('settingsConfirmPassword').value = '';
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
});

// Settings WhatsApp Session Actions
document.getElementById('btnSettingsSyncSession')?.addEventListener('click', async () => {
  showToast('Synchronizing WhatsApp session...');
  await refreshQr();
  loadSettingsPage();
});

document.getElementById('btnSettingsDisconnect')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to disconnect WhatsApp? You will need to scan QR code again to reconnect.')) {
    return;
  }
  if (!myInstance?.id) return;
  try {
    await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/reset`, { method: 'POST' });
    showToast('WhatsApp session disconnected. Opening QR pairing...');
    document.querySelector('[data-user-tab="myDeviceTab"]')?.click();
    refreshQr();
  } catch (e) {
    showToast('Disconnect error: ' + e.message, 'error');
  }
});

// Logout handler from right sidebar
document.getElementById('userLogout')?.addEventListener('click', async () => {
  await api('/api/user-auth/logout', { method: 'POST' });
  window.location.reload();
});

// ==========================================================================
// WooCommerce Automatic Integration Snippet Generator
// ==========================================================================
function renderWooCommerceSnippet() {
  if (!myInstance) return;
  const instId = myInstance.id;
  const token = myInstance.accessToken;
  const origin = window.location.origin;

  const phpSnippet = `/**
 * ====================================================================
 * WhatsApp Order Notifications for WooCommerce via Pixano Connect API
 * Drop this code into your active WordPress child theme's functions.php file.
 * ====================================================================
 */
add_action('woocommerce_thankyou', 'pixano_whatsapp_order_confirmation', 10, 1);

function pixano_whatsapp_order_confirmation($order_id) {
    if (!$order_id) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    // Retrieve recipient phone and customer details
    $phone = preg_replace('/\\D/', '', $order->get_billing_phone());
    $customer_name = $order->get_billing_first_name();
    $total_amount  = html_entity_decode(strip_tags(wc_price($order->get_total())));
    $tracking_url  = esc_url($order->get_view_order_url());

    // Auto-prefix India country code (91) if 10 digits
    if (strlen($phone) == 10) {
        $phone = '91' . $phone;
    }

    // Pixano Connect Template API Endpoint
    $api_url = '${origin}/api/send-template';
    $payload = array(
        'instance_id'   => '${instId}',
        'access_token'  => '${token}',
        'number'        => $phone,
        'template_code' => 'order_confirmation',
        'variables'     => array(
            'customer_name' => $customer_name,
            'order_id'      => '#' . $order_id,
            'amount'        => $total_amount,
            'tracking_link' => $tracking_url
        )
    );

    // Non-blocking asynchronous dispatch
    wp_remote_post($api_url, array(
        'headers'     => array('Content-Type' => 'application/json'),
        'body'        => wp_json_encode($payload),
        'timeout'     => 15,
        'blocking'    => false
    ));
}`;

  const el = document.getElementById('wooCommerceSnippetCode');
  if (el) el.textContent = phpSnippet;

  document.querySelectorAll('.tpl-replace-inst').forEach((node) => node.textContent = instId);
  document.querySelectorAll('.tpl-replace-tok').forEach((node) => node.textContent = token);
}

document.getElementById('btnCopyWooCode')?.addEventListener('click', (e) => {
  const code = document.getElementById('wooCommerceSnippetCode')?.textContent;
  if (code) {
    copyText(code, e.target, '📋 Copy WooCommerce Snippet');
    showToast('WooCommerce PHP snippet copied! Paste it into your WordPress functions.php');
  }
});

// ==========================================================================
// Template Manager (CRUD & Dynamic Rendering)
// ==========================================================================
let allTemplates = [];
let currentCategoryFilter = 'all';

async function loadTemplates() {
  const container = document.getElementById('templatesContainer');
  if (!container) return;

  try {
    const res = await api('/api/user/templates');
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to load templates.');

    allTemplates = data.data || [];
    renderTemplatesList();

    const countBadge = document.getElementById('navTplCount');
    if (countBadge) countBadge.textContent = allTemplates.length;
  } catch (err) {
    container.innerHTML = `<div class="card p-4 text-danger">Unable to load templates: ${err.message}</div>`;
  }
}

function renderTemplatesList() {
  const container = document.getElementById('templatesContainer');
  if (!container) return;

  const search = (document.getElementById('tplSearchInput')?.value || '').toLowerCase().trim();
  const filtered = allTemplates.filter((tpl) => {
    const matchesCat = currentCategoryFilter === 'all' || tpl.category === currentCategoryFilter;
    const matchesSearch = !search || tpl.name.toLowerCase().includes(search) || tpl.content.toLowerCase().includes(search) || tpl.code.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📑</div>
        <h3>No message templates found</h3>
        <p class="text-secondary">Create your first custom template to streamline your automated WhatsApp messaging.</p>
        <button type="button" class="btn btn-primary mt-3" onclick="document.getElementById('btnOpenNewTemplateModal').click()">+ Create Your First Template</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((tpl) => {
    const highlighted = tpl.content.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, '<span class="template-var-tag">{{$1}}</span>');
    const catClass = tpl.category === 'ecommerce' ? 'ecommerce' : (tpl.category === 'alerts' ? 'alerts' : '');
    const catLabel = tpl.category === 'ecommerce' ? '📦 E-Commerce' : (tpl.category === 'alerts' ? '🚨 Security Alert' : (tpl.category === 'marketing' ? '📣 Marketing' : '💬 General'));

    return `
      <div class="template-card" data-template-id="${tpl.id}">
        <div class="template-card-header">
          <h3 class="template-title">${escapeHtml(tpl.name)}</h3>
          <span class="template-cat-pill ${catClass}">${catLabel}</span>
        </div>
        <div class="template-code-badge" title="Use in API payload">
          <span>code:</span> <strong>${escapeHtml(tpl.code)}</strong>
        </div>
        <div class="template-preview-box">
          ${highlighted}
        </div>
        <div class="template-card-footer">
          <button type="button" class="btn-tpl-test" data-action="test-tpl" data-id="${tpl.id}">
            ⚡ Test Send
          </button>
          <button type="button" class="btn-tpl-icon" data-action="copy-code" data-code="${tpl.code}" title="Copy template code">
            📋
          </button>
          ${!tpl.isDefault ? `
            <button type="button" class="btn-tpl-icon danger" data-action="delete-tpl" data-id="${tpl.id}" title="Delete template">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Category filter chip listener
document.getElementById('tplCategoryFilters')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  currentCategoryFilter = chip.dataset.cat || 'all';
  renderTemplatesList();
});

// Search input listener
document.getElementById('tplSearchInput')?.addEventListener('input', () => {
  renderTemplatesList();
});

// Template card action buttons (Test Send, Copy, Delete)
document.getElementById('templatesContainer')?.addEventListener('click', async (e) => {
  const testBtn = e.target.closest('[data-action="test-tpl"]');
  if (testBtn) {
    const tplId = testBtn.dataset.id;
    const targetTpl = allTemplates.find((t) => t.id === tplId);
    if (targetTpl) openTestSendModal(targetTpl);
    return;
  }

  const copyBtn = e.target.closest('[data-action="copy-code"]');
  if (copyBtn) {
    const code = copyBtn.dataset.code;
    copyText(code, copyBtn, '📋');
    showToast(`Template code '${code}' copied!`);
    return;
  }

  const delBtn = e.target.closest('[data-action="delete-tpl"]');
  if (delBtn) {
    const tplId = delBtn.dataset.id;
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const res = await api(`/api/user/templates/${encodeURIComponent(tplId)}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.safeJson();
          throw new Error(err.error || 'Failed to delete template.');
        }
        showToast('Template deleted successfully.');
        loadTemplates();
      } catch (delErr) {
        alert(delErr.message);
      }
    }
  }
});

// ============================================================================
// Category-wise Placeholder Variables Configuration
// ============================================================================
const TPL_CATEGORIES = {
  ecommerce: {
    badge: '📦 E-Commerce',
    variables: [
      { name: 'customer_name', preview: 'Rajesh Patel' },
      { name: 'order_id', preview: '#1024' },
      { name: 'amount', preview: '₹1,500' },
      { name: 'item_name', preview: 'Wireless Earbuds' },
      { name: 'tracking_link', preview: 'https://mystore.com/track/1024' },
      { name: 'delivery_date', preview: 'Tomorrow by 4:00 PM' }
    ],
    defaultName: 'Order Confirmation Alert',
    defaultCode: 'order_confirmation_alert',
    sampleContent: 'Hi {{customer_name}}, your order #{{order_id}} for {{item_name}} (Amount: {{amount}}) is confirmed! Track live here: {{tracking_link}}'
  },
  alerts: {
    badge: '🚨 Security / Alerts',
    variables: [
      { name: 'customer_name', preview: 'Rajesh Patel' },
      { name: 'otp_code', preview: '492817' },
      { name: 'validity_minutes', preview: '10 minutes' },
      { name: 'service_name', preview: 'Pixano Security' },
      { name: 'device_name', preview: 'Chrome on Windows' },
      { name: 'login_time', preview: '10:35 AM' }
    ],
    defaultName: 'Security OTP Verification',
    defaultCode: 'security_otp_verification',
    sampleContent: 'Dear {{customer_name}}, your {{service_name}} verification OTP code is {{otp_code}}. Valid for {{validity_minutes}}. Do NOT share with anyone.'
  },
  marketing: {
    badge: '📣 Marketing & Offers',
    variables: [
      { name: 'customer_name', preview: 'Rajesh Patel' },
      { name: 'offer_title', preview: 'Mega Festive Weekend' },
      { name: 'discount_percent', preview: '25% OFF' },
      { name: 'coupon_code', preview: 'FESTIVE25' },
      { name: 'expiry_date', preview: 'Sunday midnight' },
      { name: 'shop_link', preview: 'https://mystore.com/offers' }
    ],
    defaultName: 'Special Festive Offer',
    defaultCode: 'special_festive_offer',
    sampleContent: 'Hey {{customer_name}}! 🎉 {{offer_title}} is live! Get flat {{discount_percent}} discount using code *{{coupon_code}}*. Valid till {{expiry_date}}. Shop now: {{shop_link}}'
  },
  general: {
    badge: '💬 General / Support',
    variables: [
      { name: 'customer_name', preview: 'Rajesh Patel' },
      { name: 'ticket_id', preview: '#TCK-8812' },
      { name: 'agent_name', preview: 'Pooja Sharma' },
      { name: 'company_name', preview: 'Pixano Technologies' },
      { name: 'meeting_time', preview: 'Tomorrow at 11:30 AM' },
      { name: 'action_link', preview: 'https://pixano.com/help' }
    ],
    defaultName: 'Customer Support Notice',
    defaultCode: 'customer_support_notice',
    sampleContent: 'Hello {{customer_name}}, support ticket {{ticket_id}} has been assigned to {{agent_name}} at {{company_name}}. For updates, visit: {{action_link}}'
  }
};

function renderTplCategoryVariables(catKey, isUserSwitching = false) {
  const cat = TPL_CATEGORIES[catKey] || TPL_CATEGORIES.ecommerce;
  const badgeEl = document.getElementById('tplCategoryBadge');
  if (badgeEl) badgeEl.textContent = cat.badge;

  const chipsContainer = document.getElementById('tplVarChips');
  if (chipsContainer) {
    chipsContainer.innerHTML = cat.variables.map(v => 
      `<button type="button" class="var-chip" data-var="${v.name}" title="Click to insert {{${v.name}}}">+ {{${v.name}}}</button>`
    ).join('');
  }

  if (isUserSwitching) {
    const nameInput = document.getElementById('tplNameInput');
    const codeInput = document.getElementById('tplCodeInput');
    const contentInput = document.getElementById('tplContentInput');

    const isCurrentDefault = !nameInput.value || Object.values(TPL_CATEGORIES).some(c => c.defaultName === nameInput.value);
    if (isCurrentDefault) {
      if (nameInput) nameInput.value = cat.defaultName;
      if (codeInput) codeInput.value = cat.defaultCode;
      if (contentInput) contentInput.value = cat.sampleContent;
    }
  }

  updateTplModalLivePreview();
}

// Modal: Create New Template
const modalNewTpl = document.getElementById('modalNewTemplate');

document.getElementById('btnOpenNewTemplateModal')?.addEventListener('click', () => {
  if (modalNewTpl) {
    modalNewTpl.classList.remove('hidden');
    const errBox = document.getElementById('tplErrorMsg');
    if (errBox) errBox.classList.add('hidden');

    const catSelect = document.getElementById('tplCategorySelect');
    const selectedCat = catSelect ? catSelect.value : 'ecommerce';
    renderTplCategoryVariables(selectedCat, false);

    const nameInput = document.getElementById('tplNameInput');
    const codeInput = document.getElementById('tplCodeInput');
    const contentInput = document.getElementById('tplContentInput');

    // Pre-populate with category default if empty
    if (nameInput && !nameInput.value) nameInput.value = TPL_CATEGORIES[selectedCat].defaultName;
    if (codeInput && !codeInput.value) codeInput.value = TPL_CATEGORIES[selectedCat].defaultCode;
    if (contentInput && !contentInput.value) contentInput.value = TPL_CATEGORIES[selectedCat].sampleContent;

    updateTplModalLivePreview();
  }
});

document.getElementById('btnCloseNewTplModal')?.addEventListener('click', () => {
  modalNewTpl?.classList.add('hidden');
});

document.getElementById('btnCancelNewTpl')?.addEventListener('click', () => {
  modalNewTpl?.classList.add('hidden');
});

// Category Dropdown change handler: updates variable chips dynamically!
document.getElementById('tplCategorySelect')?.addEventListener('change', (e) => {
  renderTplCategoryVariables(e.target.value, true);
});

// Auto-generate template code as user types template name
document.getElementById('tplNameInput')?.addEventListener('input', (e) => {
  const name = e.target.value;
  const autoCode = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const codeInput = document.getElementById('tplCodeInput');
  if (codeInput) {
    codeInput.value = autoCode;
  }
});

// Variable chip insertion into content textarea
document.getElementById('tplVarChips')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.var-chip');
  if (!chip) return;
  const varName = chip.dataset.var;
  const textarea = document.getElementById('tplContentInput');
  if (!textarea) return;

  const start = (typeof textarea.selectionStart === 'number') ? textarea.selectionStart : textarea.value.length;
  const end = (typeof textarea.selectionEnd === 'number') ? textarea.selectionEnd : textarea.value.length;
  const insertText = `{{${varName}}}`;
  textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + insertText.length;

  updateTplModalLivePreview();
});

function updateTplModalLivePreview() {
  const content = document.getElementById('tplContentInput')?.value || '';
  const preview = document.getElementById('tplLivePreview');
  if (!preview) return;

  if (!content.trim()) {
    preview.innerHTML = '<span style="color:#64748b; font-style:italic;">Type template content above to see live preview...</span>';
    return;
  }

  let rendered = content;
  // Replace each known variable across all categories with realistic sample data
  Object.values(TPL_CATEGORIES).forEach(cat => {
    cat.variables.forEach(v => {
      const reg = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
      rendered = rendered.replace(reg, v.preview);
    });
  });

  // Any other custom variable fallback e.g. {{anything}} -> [anything]
  rendered = rendered.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, '[$1]');

  preview.textContent = rendered;
}

const tplContentEl = document.getElementById('tplContentInput');
if (tplContentEl) {
  ['input', 'keyup', 'change', 'paste'].forEach((evt) => {
    tplContentEl.addEventListener(evt, updateTplModalLivePreview);
  });
}

// Form Submit: Create Template
document.getElementById('formNewTemplate')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('tplErrorMsg');
  if (errorBox) errorBox.classList.add('hidden');

  const nameInput = document.getElementById('tplNameInput');
  const contentInput = document.getElementById('tplContentInput');
  const name = (nameInput?.value || '').trim();
  let code = (document.getElementById('tplCodeInput')?.value || '').trim();
  const category = document.getElementById('tplCategorySelect')?.value || 'ecommerce';
  const content = (contentInput?.value || '').trim();

  if (!name) {
    if (errorBox) {
      errorBox.textContent = 'Please enter a Template Display Name.';
      errorBox.classList.remove('hidden');
    }
    nameInput?.focus();
    return;
  }

  if (!content) {
    if (errorBox) {
      errorBox.textContent = 'Please enter Message Template Content.';
      errorBox.classList.remove('hidden');
    }
    contentInput?.focus();
    return;
  }

  if (!code) {
    code = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  const submitBtn = document.getElementById('btnSaveTemplate');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Template...';
  }

  try {
    const res = await api('/api/user/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, category, content })
    });
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to save template.');

    modalNewTpl?.classList.add('hidden');
    showToast('New template created successfully!');
    if (nameInput) nameInput.value = '';
    if (contentInput) contentInput.value = '';
    if (document.getElementById('tplCodeInput')) document.getElementById('tplCodeInput').value = '';
    await loadTemplates();
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Template';
    }
  }
});

// Modal: Test Send Template
let currentTestTemplate = null;
const modalTestSend = document.getElementById('modalTestSendTemplate');

function openTestSendModal(template) {
  currentTestTemplate = template;
  if (!modalTestSend) return;

  document.getElementById('testTplModalTitle').textContent = `Test Send: ${template.name}`;
  document.getElementById('testTplModalCode').textContent = `Code: ${template.code}`;
  document.getElementById('testTplErrorMsg')?.classList.add('hidden');

  const container = document.getElementById('testTplVariablesContainer');
  if (container) {
    if (!template.variables || template.variables.length === 0) {
      container.innerHTML = '<span class="text-secondary" style="font-size:0.85rem;">This template has no dynamic placeholders.</span>';
    } else {
      container.innerHTML = template.variables.map((v) => {
        let defaultVal = '';
        if (v.includes('name')) defaultVal = 'Rajesh Patel';
        else if (v.includes('order')) defaultVal = '#1048';
        else if (v.includes('amount') || v.includes('price')) defaultVal = '₹1,999';
        else if (v.includes('link') || v.includes('url')) defaultVal = 'https://mystore.com';
        else if (v.includes('time') || v.includes('date')) defaultVal = 'Just now';

        return `
          <div class="dynamic-var-item">
            <label for="var_${v}">{{${v}}}</label>
            <input type="text" id="var_${v}" data-var-key="${v}" value="${defaultVal}" placeholder="Enter ${v}" />
          </div>
        `;
      }).join('');
    }
  }

  updateTestTplPreview();
  modalTestSend.classList.remove('hidden');
}

function updateTestTplPreview() {
  if (!currentTestTemplate) return;
  const inputs = document.querySelectorAll('#testTplVariablesContainer input[data-var-key]');
  const vars = {};
  inputs.forEach((inp) => {
    vars[inp.dataset.varKey] = inp.value;
  });

  let rendered = currentTestTemplate.content;
  for (const [k, v] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
  }

  const preview = document.getElementById('testTplRenderedPreview');
  if (preview) preview.textContent = rendered;
}

document.getElementById('testTplVariablesContainer')?.addEventListener('input', updateTestTplPreview);

document.getElementById('btnCloseTestTplModal')?.addEventListener('click', () => {
  modalTestSend?.classList.add('hidden');
});

document.getElementById('btnCancelTestTpl')?.addEventListener('click', () => {
  modalTestSend?.classList.add('hidden');
});

// Auto-prefix 91 on blur or paste for Test Send Recipient Phone
const testTplPhoneEl = document.getElementById('testTplPhone');
testTplPhoneEl?.addEventListener('blur', () => {
  if (testTplPhoneEl.value) {
    const formatted = formatToIndianWhatsAppNumber(testTplPhoneEl.value);
    if (formatted) testTplPhoneEl.value = formatted;
  }
});
testTplPhoneEl?.addEventListener('paste', () => {
  setTimeout(() => {
    if (testTplPhoneEl.value) {
      const formatted = formatToIndianWhatsAppNumber(testTplPhoneEl.value);
      if (formatted) testTplPhoneEl.value = formatted;
    }
  }, 30);
});

// Form Submit: Test Send Template Message
document.getElementById('formTestSendTemplate')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!myInstance?.id || !currentTestTemplate) return;

  const rawPhone = document.getElementById('testTplPhone').value.trim();
  const phone = formatToIndianWhatsAppNumber(rawPhone);
  if (document.getElementById('testTplPhone') && phone) {
    document.getElementById('testTplPhone').value = phone;
  }
  const errorBox = document.getElementById('testTplErrorMsg');
  if (errorBox) errorBox.classList.add('hidden');

  const inputs = document.querySelectorAll('#testTplVariablesContainer input[data-var-key]');
  const variables = {};
  inputs.forEach((inp) => {
    variables[inp.dataset.varKey] = inp.value.trim();
  });

  const submitBtn = document.getElementById('btnSubmitTestSend');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
  }

  try {
    const res = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: currentTestTemplate.id,
        phoneNumber: phone,
        variables
      })
    });

    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch template message.');

    modalTestSend?.classList.add('hidden');
    showToast(`Template message sent to +${phone}!`);
    refreshUserMe();
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀 Send Test Message Now</span>';
    }
  }
});

// ==========================================================================
// Delivery Logs & Analytics Engine
// ==========================================================================
async function loadLogs() {
  const tbody = document.getElementById('masterLogTableBody');
  if (!tbody) return;

  try {
    const res = await api('/api/user/logs?limit=50');
    const data = await res.safeJson();
    if (!res.ok) throw new Error(data.error || 'Failed to load logs.');

    const logs = data.data || [];
    if (logs.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No delivery logs recorded yet. Send a message to see live logs.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map((log) => {
      const isSent = log.status === 'sent';
      const statusBadge = isSent
        ? '<span class="status-pill status-connected" style="display:inline-flex; padding:2px 8px; font-size:0.75rem;">✓ Sent</span>'
        : '<span class="status-pill status-disconnected" style="display:inline-flex; padding:2px 8px; font-size:0.75rem;">✕ Failed</span>';

      const typeBadge = `<span class="tag-pill tag-secure" style="font-size:0.72rem;">${log.type || 'single'}</span>`;
      const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';

      return `
        <tr>
          <td style="white-space:nowrap; font-size:0.8rem; color:#64748b;">${timeStr}</td>
          <td><strong>+${escapeHtml(log.recipient)}</strong></td>
          <td>${typeBadge}</td>
          <td style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(log.preview)}">
            ${escapeHtml(log.preview)}
          </td>
          <td>${statusBadge}</td>
          <td style="font-size:0.78rem; color:${isSent ? '#008069' : '#ef4444'};">
            ${escapeHtml(log.error || 'Delivered to WhatsApp')}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Failed to load logs: ${err.message}</td></tr>`;
  }
}

async function loadStats() {
  try {
    const res = await api('/api/user/stats');
    const data = await res.safeJson();
    if (!res.ok) return;

    const stats = data.data;
    if (document.getElementById('kpiTotalDispatched')) {
      document.getElementById('kpiTotalDispatched').textContent = stats.totalDispatched.toLocaleString();
    }
    if (document.getElementById('kpiSuccessRate')) {
      document.getElementById('kpiSuccessRate').textContent = `${stats.successRate}%`;
    }
    if (document.getElementById('kpiSentToday')) {
      document.getElementById('kpiSentToday').textContent = stats.sentToday.toLocaleString();
    }
  } catch (_) {}
}

document.getElementById('btnRefreshLogs')?.addEventListener('click', () => {
  loadLogs();
  loadStats();
  showToast('Logs refreshed.');
});

document.getElementById('btnClearLogs')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear your message delivery history?')) {
    try {
      await api('/api/user/logs', { method: 'DELETE' });
      showToast('Delivery logs cleared.');
      loadLogs();
      loadStats();
    } catch (_) {
      alert('Unable to clear logs.');
    }
  }
});

// ==========================================================================
// Header Profile Menu & Dropdown Logic
// ==========================================================================
const headerProfileBtn = document.getElementById('headerProfileBtn');
const headerProfileContainer = document.getElementById('headerProfileContainer');
const headerProfileDropdown = document.getElementById('headerProfileDropdown');

headerProfileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !headerProfileDropdown.classList.contains('hidden');
  if (isOpen) {
    headerProfileDropdown.classList.add('hidden');
    headerProfileContainer.classList.remove('open');
    headerProfileBtn.setAttribute('aria-expanded', 'false');
  } else {
    headerProfileDropdown.classList.remove('hidden');
    headerProfileContainer.classList.add('open');
    headerProfileBtn.setAttribute('aria-expanded', 'true');
  }
});

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (headerProfileContainer && !headerProfileContainer.contains(e.target)) {
    headerProfileDropdown?.classList.add('hidden');
    headerProfileContainer?.classList.remove('open');
    headerProfileBtn?.setAttribute('aria-expanded', 'false');
  }
});

// Dropdown quick navigation items
document.querySelectorAll('[data-dropdown-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-dropdown-tab');
    if (tabName) {
      const targetNav = document.querySelector(`[data-user-tab="${tabName}"]`);
      if (targetNav) targetNav.click();
    }
    headerProfileDropdown?.classList.add('hidden');
    headerProfileContainer?.classList.remove('open');
  });
});

document.getElementById('btnDropdownRecharge')?.addEventListener('click', () => {
  const plansNav = document.querySelector('[data-user-tab="plansTab"]');
  if (plansNav) plansNav.click();
  headerProfileDropdown?.classList.add('hidden');
  headerProfileContainer?.classList.remove('open');
});

document.getElementById('headerPlanBadge')?.addEventListener('click', () => {
  const plansNav = document.querySelector('[data-user-tab="plansTab"]');
  if (plansNav) plansNav.click();
});

document.getElementById('headerDropdownLogout')?.addEventListener('click', () => {
  headerProfileDropdown?.classList.add('hidden');
  headerProfileContainer?.classList.remove('open');
  document.getElementById('userLogout')?.click();
});
