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

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

function handleSingleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Image size exceeds 10MB limit. Please choose a smaller image.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    attachedSingleMedia = {
      data: dataUrl,
      name: file.name,
      size: file.size,
      mime: file.type
    };
    if (userSingleThumb) userSingleThumb.src = dataUrl;
    if (userSingleAttachName) userSingleAttachName.textContent = file.name;
    if (userSingleAttachSize) userSingleAttachSize.textContent = formatFileSize(file.size);
    if (userSingleDropPrompt) userSingleDropPrompt.classList.add('hidden');
    if (userSingleAttachPreview) userSingleAttachPreview.classList.remove('hidden');

    if (phoneWaImg) phoneWaImg.src = dataUrl;
    if (phoneWaImgWrap) phoneWaImgWrap.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
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

if (userSingleForm) {
  userSingleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = document.getElementById('userSinglePhone').value.trim();
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
      }

      const response = await api(`/api/user/instances/${encodeURIComponent(myInstance.id)}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.safeJson();
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      setResult('userSingleResult', attachedSingleMedia ? 'Image and message sent successfully.' : 'Message sent successfully.');
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
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Image size exceeds 10MB limit. Please choose a smaller image.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    attachedBulkMedia = {
      data: dataUrl,
      name: file.name,
      size: file.size,
      mime: file.type
    };
    if (userBulkThumb) userBulkThumb.src = dataUrl;
    if (userBulkAttachName) userBulkAttachName.textContent = file.name;
    if (userBulkAttachSize) userBulkAttachSize.textContent = formatFileSize(file.size);
    if (userBulkDropPrompt) userBulkDropPrompt.classList.add('hidden');
    if (userBulkAttachPreview) userBulkAttachPreview.classList.remove('hidden');

    if (userBulkPreviewImg) userBulkPreviewImg.src = dataUrl;
    if (userBulkPreviewImgWrap) userBulkPreviewImgWrap.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
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
    return userBulkNumbers.value.split(/[\r\n,\s]+/).map((value) => value.replace(/\D/g, '')).filter((value, index, list) => value.length >= 10 && list.indexOf(value) === index).slice(0, 100);
  }

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
      if (data && data.data) openDashboard(data.data);
    }
  } catch (_) {}
})();
