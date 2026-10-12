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

// Dynamic Base URL detection
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
    if (!res.ok) {
      document.body.classList.add('auth-required');
      if (loginScreen) loginScreen.classList.remove('hidden');
      return false;
    }
    const json = await res.json();
    if (!json.success) {
      document.body.classList.add('auth-required');
      if (loginScreen) loginScreen.classList.remove('hidden');
      return false;
    }

    document.body.classList.remove('auth-required');
    if (loginScreen) loginScreen.classList.add('hidden');

    if (json.data) {
      if (adminDisplayName) adminDisplayName.textContent = json.data.displayName || json.data.username || 'Administrator';
      if (adminProfileFullName) adminProfileFullName.textContent = json.data.displayName || 'Safe Vault Administrator';
    }
    return true;
  } catch (_) {
    document.body.classList.add('auth-required');
    if (loginScreen) loginScreen.classList.remove('hidden');
    return false;
  }
}

function startAdminConsole() {
  setupNavigationTabs();
  setupProfileDropdown();
  setupDashboardControls();
  setupUserManagement();
  setupUserDetailsModal();
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

      try {
        const res = await apiFetch('/api/auth/login', {
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
    if (kpiActiveUsers) {
      if (users.pending > 0) {
        kpiActiveUsers.textContent = `${users.active || 0} Active • ${users.pending} Pending`;
        kpiActiveUsers.style.color = '#d97706';
      } else {
        kpiActiveUsers.textContent = `${users.active || 0} Active`;
        kpiActiveUsers.style.color = '';
      }
    }
    if (sidebarUserCount) {
      if (users.pending > 0) {
        sidebarUserCount.textContent = `${users.pending} Pending`;
        sidebarUserCount.style.background = '#f59e0b';
        sidebarUserCount.style.color = '#ffffff';
      } else {
        sidebarUserCount.textContent = users.total || 0;
        sidebarUserCount.style.background = '';
        sidebarUserCount.style.color = '';
      }
    }

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
  const deviceFilter = document.getElementById('userDeviceFilter');
  const btnReload = document.getElementById('btnReloadUsers');

  if (searchInput) searchInput.addEventListener('input', applyUserFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyUserFilters);
  if (planFilter) planFilter.addEventListener('change', applyUserFilters);
  if (deviceFilter) deviceFilter.addEventListener('change', applyUserFilters);
  if (btnReload) btnReload.addEventListener('click', () => { loadUsers(); showToast('Users refreshed.', 'success'); });

  // Add User Modal setup
  const btnAddUser = document.getElementById('btnAdminAddUser');
  const modalAddUser = document.getElementById('modalAdminAddUser');
  const btnCloseAddUser = document.getElementById('btnCloseAddUserModal');
  const btnCancelAddUser = document.getElementById('btnCancelAddUser');
  const formAddUser = document.getElementById('formAdminAddUser');
  const errAddUser = document.getElementById('addUserErrorMsg');

  if (btnAddUser) {
    btnAddUser.addEventListener('click', () => {
      if (modalAddUser) {
        modalAddUser.classList.remove('hidden');
        if (errAddUser) errAddUser.classList.add('hidden');
        formAddUser?.reset();
      }
    });
  }

  const closeAddUserModal = () => modalAddUser?.classList.add('hidden');
  if (btnCloseAddUser) btnCloseAddUser.addEventListener('click', closeAddUserModal);
  if (btnCancelAddUser) btnCancelAddUser.addEventListener('click', closeAddUserModal);

  if (formAddUser) {
    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitAddUser');
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        fullName: document.getElementById('addUserName')?.value || '',
        username: document.getElementById('addUserUsername')?.value || '',
        email: document.getElementById('addUserEmail')?.value || '',
        phone: document.getElementById('addUserPhone')?.value || '',
        password: document.getElementById('addUserPassword')?.value || '',
        plan: document.getElementById('addUserPlan')?.value || 'Pro SaaS Plan'
      };

      try {
        const res = await apiFetch('/api/admin/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create user.');

        showToast(json.message || 'User created successfully!', 'success');
        closeAddUserModal();
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        if (errAddUser) {
          errAddUser.textContent = err.message;
          errAddUser.classList.remove('hidden');
        } else {
          showToast(err.message, 'error');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Close kebab dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-kebab-wrap')) {
      document.querySelectorAll('.kebab-dropdown').forEach((m) => m.classList.add('hidden'));
    }
  });

  // Delegated user actions (Topup, Plan, Toggle status, Reset, Delete, Kebab menu)
  const usersTbody = document.getElementById('adminUsersTableBody');
  if (usersTbody) {
    usersTbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-user-action]');
      if (!btn) return;

      const action = btn.dataset.userAction;
      const userId = btn.dataset.userId;

      // Handle kebab dropdown toggle
      if (action === 'toggle-kebab') {
        const menu = document.getElementById(`kebabMenu_${userId}`);
        const wasHidden = menu ? menu.classList.contains('hidden') : true;
        document.querySelectorAll('.kebab-dropdown').forEach((m) => m.classList.add('hidden'));
        if (menu && wasHidden) menu.classList.remove('hidden');
        return;
      }

      // Close all kebabs upon clicking any action item
      document.querySelectorAll('.kebab-dropdown').forEach((m) => m.classList.add('hidden'));

      const user = allUsersCache.find((u) => u.id === userId);
      if (!user) return;

      if (action === 'view-details') {
        openUserDetailsModal(userId);
      } else if (action === 'approve') {
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/admin/users/${userId}/approve`, { method: 'POST' });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to approve user.');
          showToast(json.message || 'User approved successfully!', 'success');
          loadUsers();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      } else if (action === 'reject') {
        const reason = prompt(`Enter rejection reason for '${user.fullName || user.username}' (optional):`, 'Not eligible / Incomplete details');
        if (reason === null) return;
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/admin/users/${userId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to reject user.');
          showToast(json.message || 'User account rejected.', 'info');
          loadUsers();
          loadDashboardStats();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      } else if (action === 'topup') {
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
    updateUserStatusCounts();
    applyUserFilters();
  } catch (err) {
    console.error('Failed to load users:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger" style="text-align: center; padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function updateUserStatusCounts() {
  const all = allUsersCache.length;
  const pending = allUsersCache.filter((u) => u.status === 'pending' || !u.isApproved).length;
  const active = allUsersCache.filter((u) => (u.status === 'active' || !u.status) && u.isApproved).length;
  const suspended = allUsersCache.filter((u) => u.status === 'inactive' || u.status === 'suspended').length;
  const rejected = allUsersCache.filter((u) => u.status === 'rejected').length;

  const elAll = document.getElementById('countAllUsers');
  const elPending = document.getElementById('countPendingUsers');
  const elActive = document.getElementById('countActiveUsers');
  const elSuspended = document.getElementById('countSuspendedUsers');
  const elRejected = document.getElementById('countRejectedUsers');

  if (elAll) elAll.textContent = all;
  if (elPending) elPending.textContent = pending;
  if (elActive) elActive.textContent = active;
  if (elSuspended) elSuspended.textContent = suspended;
  if (elRejected) elRejected.textContent = rejected;
}

const AVATAR_PALETTE = ['#0ea5e9', '#0284c7', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#2563eb', '#7c3aed'];

function applyUserFilters() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
  const planFilter = document.getElementById('userPlanFilter')?.value || 'all';
  const deviceFilter = document.getElementById('userDeviceFilter')?.value || 'all';

  let filtered = allUsersCache.filter((u) => {
    const matchesSearch = !searchTerm ||
      (u.fullName && u.fullName.toLowerCase().includes(searchTerm)) ||
      (u.username && u.username.toLowerCase().includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm)) ||
      (u.phone && String(u.phone).includes(searchTerm));

    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = u.status === 'pending' || !u.isApproved;
    } else if (statusFilter === 'rejected') {
      matchesStatus = u.status === 'rejected';
    } else if (statusFilter !== 'all') {
      matchesStatus = u.status === statusFilter;
    }

    const matchesPlan = planFilter === 'all' || (u.plan && u.plan.toLowerCase().includes(planFilter.toLowerCase()));

    let matchesDevice = true;
    if (deviceFilter === 'connected') {
      matchesDevice = Boolean(u.instance && u.instance.isConnected);
    } else if (deviceFilter === 'scan_pending') {
      matchesDevice = Boolean(u.instance && !u.instance.isConnected);
    } else if (deviceFilter === 'no_instance') {
      matchesDevice = !u.instance;
    }

    return matchesSearch && matchesStatus && matchesPlan && matchesDevice;
  });

  const footerInfo = document.getElementById('userTableFooterInfo');
  if (footerInfo) {
    footerInfo.textContent = `Showing 1-${filtered.length} of ${allUsersCache.length} users`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-secondary" style="text-align: center; padding: 3rem; font-size: 0.9rem;">No registered users match your search or filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => {
    const quota = u.messageQuota || 2500;
    const used = u.messagesUsed || 0;
    const remaining = Math.max(0, quota - used);
    const percent = Math.min(100, Math.round((used / quota) * 100));

    const isPending = u.status === 'pending' || !u.isApproved;
    const isRejected = u.status === 'rejected';
    const isSuspended = u.status === 'inactive' || u.status === 'suspended';

    let statusPillHtml = '';
    if (isPending) {
      statusPillHtml = `<span class="status-pill-pending"><span class="dot"></span> Active</span>`;
    } else if (isRejected) {
      statusPillHtml = `<span class="status-pill-suspended"><span class="dot"></span> Rejected</span>`;
    } else if (isSuspended) {
      statusPillHtml = `<span class="status-pill-suspended"><span class="dot"></span> Suspended</span>`;
    } else {
      statusPillHtml = `<span class="status-pill-active"><span class="dot"></span> Active</span>`;
    }

    let planBadgeClass = 'badge-plan-pro';
    let planText = 'PRO SAAS PLAN';
    if (u.plan && u.plan.toLowerCase().includes('starter')) {
      planBadgeClass = 'badge-plan-starter';
      planText = 'STARTER BOOSTER';
    } else if (u.plan && u.plan.toLowerCase().includes('agency')) {
      planBadgeClass = 'badge-plan-agency';
      planText = 'AGENCY MASTER';
    } else if (u.plan) {
      planText = u.plan.toUpperCase();
    }

    const inst = u.instance;
    let instStatusHtml = `
      <div style="display: flex; align-items: center; gap: 0.45rem;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex-shrink: 0;"></span>
        <span style="color: #94a3b8; font-size: 0.8rem;">No Instance</span>
      </div>
    `;
    if (inst) {
      const isConn = inst.isConnected;
      const dotColor = isConn ? '#16a34a' : '#f59e0b';
      const label = inst.phone ? '+' + inst.phone : 'Scan Pending';
      instStatusHtml = `
        <div>
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
            <span style="font-weight: 700; font-size: 0.82rem; color: #0f172a;">${escapeHtml(label)}</span>
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; font-family: monospace; padding-left: 0.95rem; margin-top: 1px;">
            ID: ${escapeHtml(inst.id)}
          </div>
        </div>
      `;
    }

    const avatarBg = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
    const initial = (u.fullName || u.username || 'U')[0].toUpperCase();
    const joinedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-';
    const templateCount = u.templateCount !== undefined ? u.templateCount : 0;
    const phoneDisplay = u.phone ? (String(u.phone).startsWith('+') ? u.phone : '+' + u.phone) : (u.username || '-');

    return `
      <tr>
        <td style="padding-left: 1.25rem;">
          <span class="user-index-num">${idx + 1}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="user-avatar-circle" style="background: ${avatarBg};">${initial}</div>
            <div style="min-width: 0; overflow: hidden;">
              <button class="user-profile-title" type="button" data-user-action="view-details" data-user-id="${u.id}" title="Click to track user history & templates">
                ${escapeHtml(u.fullName || u.username)}
              </button>
              <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(phoneDisplay)} &bull; ${escapeHtml(u.email || '-')}
              </div>
              <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
                ${templateCount} Templates &bull; Joined: ${joinedDate}
              </div>
            </div>
          </div>
        </td>
        <td>
          <span class="${planBadgeClass}">${escapeHtml(planText)}</span>
        </td>
        <td>
          <div style="max-width: 170px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 4px;">
              <span style="font-weight: 700; color: #0f172a;">${used.toLocaleString()} / ${quota.toLocaleString()}</span>
              <span style="color: #16a34a; font-weight: 700; font-size: 0.78rem;">${remaining.toLocaleString()} left</span>
            </div>
            <div style="height: 4px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
              <div style="width: ${percent}%; height: 100%; background: #2563eb; border-radius: 999px;"></div>
            </div>
          </div>
        </td>
        <td>${instStatusHtml}</td>
        <td>${statusPillHtml}</td>
        <td style="text-align: right; padding-right: 1.25rem;">
          <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.45rem;">
            ${isPending ? `
              <button class="btn-user-approve" type="button" data-user-action="approve" data-user-id="${u.id}" title="Approve account">
                ✓ Approve
              </button>
            ` : `
              <button class="${isSuspended ? 'btn-user-activate' : 'btn-user-suspend'}" type="button" data-user-action="toggle-status" data-user-id="${u.id}" title="${isSuspended ? 'Activate account' : 'Suspend account'}">
                ${isSuspended ? '▶ Activate' : '⊘ Suspend'}
              </button>
            `}
            <div class="user-kebab-wrap">
              <button class="btn-kebab-menu" type="button" data-user-action="toggle-kebab" data-user-id="${u.id}" title="More options">
                ⋮
              </button>
              <div class="kebab-dropdown hidden" id="kebabMenu_${u.id}">
                <button type="button" data-user-action="view-details" data-user-id="${u.id}">
                  <span>🔍</span> View Details &amp; Tracking
                </button>
                <button type="button" data-user-action="plan" data-user-id="${u.id}">
                  <span>🏷️</span> Change Subscription Plan
                </button>
                <button type="button" data-user-action="topup" data-user-id="${u.id}">
                  <span>⚡</span> Top-Up Credits
                </button>
                ${inst ? `
                <button type="button" data-user-action="reset-session" data-user-id="${u.id}">
                  <span>🔁</span> Reset WhatsApp Session
                </button>
                ` : ''}
                ${!isRejected ? `
                <button type="button" data-user-action="reject" data-user-id="${u.id}">
                  <span>✕</span> Reject Account
                </button>
                ` : ''}
                <div class="kebab-dropdown-divider"></div>
                <button type="button" class="danger-item" data-user-action="delete" data-user-id="${u.id}">
                  <span>🗑️</span> Delete Account
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// User Details, Tracking & History Modal Handlers
// ==========================================================================
let currentModalUserId = null;

function setupUserDetailsModal() {
  const modal = document.getElementById('userDetailsModal');
  const btnClose = document.getElementById('btnCloseUserDetailsModal');
  const tabBtns = modal?.querySelectorAll('[data-user-modal-tab]');
  const btnApprove = document.getElementById('udmBtnApprove');
  const btnTopup = document.getElementById('udmBtnTopup');
  const btnPairQr = document.getElementById('udmBtnPairQr');
  const btnResetSession = document.getElementById('udmBtnResetSession');
  const btnUdmPlan = document.getElementById('udmBtnChangePlan');
  const btnInlinePlan = document.getElementById('udmInlineChangePlan');

  const closeModal = () => {
    modal?.classList.add('hidden');
    currentModalUserId = null;
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);

  // Tab switching inside user details modal
  tabBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      modal.querySelectorAll('.user-modal-tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.userModalTab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      if (!currentModalUserId) return;
      btnApprove.disabled = true;
      try {
        const res = await apiFetch(`/api/admin/users/${currentModalUserId}/approve`, { method: 'POST' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to approve user.');
        showToast(json.message || 'User approved successfully!', 'success');
        openUserDetailsModal(currentModalUserId);
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnApprove.disabled = false;
      }
    });
  }

  const handleChangePlanClick = () => {
    if (!currentModalUserId) return;
    const user = allUsersCache.find((u) => u.id === currentModalUserId);
    if (user) openChangePlanModal(user);
  };
  if (btnUdmPlan) btnUdmPlan.addEventListener('click', handleChangePlanClick);
  if (btnInlinePlan) btnInlinePlan.addEventListener('click', handleChangePlanClick);

  if (btnTopup) {
    btnTopup.addEventListener('click', () => {
      if (!currentModalUserId) return;
      const user = allUsersCache.find((u) => u.id === currentModalUserId);
      if (user) openTopupModal(user);
    });
  }

  if (btnPairQr) {
    btnPairQr.addEventListener('click', () => {
      const instId = btnPairQr.dataset.instanceId;
      const instName = btnPairQr.dataset.instanceName;
      if (instId) openInstanceQrModal(instId, instName);
    });
  }

  if (btnResetSession) {
    btnResetSession.addEventListener('click', async () => {
      if (!currentModalUserId) return;
      if (!confirm('Force reset this user\'s WhatsApp session?')) return;
      btnResetSession.disabled = true;
      try {
        const res = await apiFetch('/api/admin/users/reset-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentModalUserId })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to reset session.');
        showToast('WhatsApp session reset successfully.', 'success');
        openUserDetailsModal(currentModalUserId);
        loadUsers();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnResetSession.disabled = false;
      }
    });
  }
}

async function openUserDetailsModal(userId) {
  currentModalUserId = userId;
  const modal = document.getElementById('userDetailsModal');
  if (!modal) return;

  modal.classList.remove('hidden');

  // Reset tab selection to tab 1
  modal.querySelectorAll('[data-user-modal-tab]').forEach((b, idx) => {
    if (idx === 0) b.classList.add('active');
    else b.classList.remove('active');
  });
  modal.querySelectorAll('.user-modal-tab-pane').forEach((p, idx) => {
    if (idx === 0) p.classList.add('active');
    else p.classList.remove('active');
  });

  const templatesContainer = document.getElementById('udmTemplatesContainer');
  if (templatesContainer) templatesContainer.innerHTML = `<p class="text-secondary" style="padding: 2rem; text-align: center;">Loading templates...</p>`;
  const logsTbody = document.getElementById('udmLogsTableBody');
  if (logsTbody) logsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">Loading logs...</td></tr>`;

  try {
    const res = await apiFetch(`/api/admin/users/${userId}/details`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch user tracking details.');

    const { user, primaryInstance, templates, logs, stats, transactions } = json.data;

    // Header Profile
    const initial = (user.fullName || user.username || 'U')[0].toUpperCase();
    const avatarEl = document.getElementById('udmAvatar');
    if (avatarEl) avatarEl.textContent = initial;
    const nameEl = document.getElementById('udmFullName');
    if (nameEl) nameEl.textContent = user.fullName || user.username || 'User';
    const subTitleEl = document.getElementById('udmSubTitle');
    if (subTitleEl) subTitleEl.textContent = `@${user.username} • ${user.email || 'No Email'} • ${user.phone ? '+' + user.phone : 'No Phone'}`;

    const isPending = user.status === 'pending' || !user.isApproved;
    const isRejected = user.status === 'rejected';
    const statusBadge = document.getElementById('udmStatusBadge');
    if (statusBadge) {
      if (isPending) {
        statusBadge.className = 'status-pill status-pending';
        statusBadge.textContent = '⏳ Pending Approval';
      } else if (isRejected) {
        statusBadge.className = 'status-pill status-rejected';
        statusBadge.textContent = '✕ Rejected';
      } else if (user.status === 'inactive' || user.status === 'suspended') {
        statusBadge.className = 'status-pill status-disconnected';
        statusBadge.textContent = 'Suspended';
      } else {
        statusBadge.className = 'status-pill status-connected';
        statusBadge.textContent = '✓ Active';
      }
    }

    const btnApprove = document.getElementById('udmBtnApprove');
    if (btnApprove) {
      if (isPending) btnApprove.classList.remove('hidden');
      else btnApprove.classList.add('hidden');
    }

    // Tabs count badges
    const tmplBadge = document.getElementById('udmTemplateCountBadge');
    if (tmplBadge) tmplBadge.textContent = templates?.length || 0;
    const logsBadge = document.getElementById('udmLogsCountBadge');
    if (logsBadge) logsBadge.textContent = logs?.length || 0;
    const txBadge = document.getElementById('udmTxCountBadge');
    if (txBadge) txBadge.textContent = transactions?.length || 0;

    // KPI values
    const quota = user.messageQuota || 2500;
    const used = user.messagesUsed || 0;
    const remaining = Math.max(0, quota - used);
    const percent = Math.min(100, Math.round((used / quota) * 100));

    const credRemEl = document.getElementById('udmCreditsRemaining');
    if (credRemEl) credRemEl.textContent = remaining.toLocaleString();
    const quotaSumEl = document.getElementById('udmQuotaSummary');
    if (quotaSumEl) quotaSumEl.textContent = `of ${quota.toLocaleString()} Quota`;
    const msgUsedEl = document.getElementById('udmMessagesUsed');
    if (msgUsedEl) msgUsedEl.textContent = used.toLocaleString();
    const usagePctEl = document.getElementById('udmUsagePercent');
    if (usagePctEl) usagePctEl.textContent = `${percent}% consumed`;
    const tmplTotalEl = document.getElementById('udmTemplatesTotal');
    if (tmplTotalEl) tmplTotalEl.textContent = templates?.length || 0;

    const waStatusEl = document.getElementById('udmWaStatus');
    const waPhoneEl = document.getElementById('udmWaPhone');
    if (primaryInstance) {
      const isConn = primaryInstance.isConnected;
      if (waStatusEl) {
        waStatusEl.textContent = isConn ? 'Connected' : (primaryInstance.status === 'QR_READY' ? 'QR Ready' : 'Disconnected');
        waStatusEl.style.color = isConn ? '#16a34a' : '#f59e0b';
      }
      if (waPhoneEl) waPhoneEl.textContent = primaryInstance.phone ? `+${primaryInstance.phone}` : 'Scan QR Pending';
    } else {
      if (waStatusEl) {
        waStatusEl.textContent = 'No Instance';
        waStatusEl.style.color = '#94a3b8';
      }
      if (waPhoneEl) waPhoneEl.textContent = 'Standby';
    }

    // Account Details
    const elUid = document.getElementById('udmUserId');
    if (elUid) elUid.textContent = user.id || '-';
    const elUname = document.getElementById('udmUsername');
    if (elUname) elUname.textContent = user.username || '-';
    const elEmail = document.getElementById('udmEmail');
    if (elEmail) elEmail.textContent = user.email || '-';
    const elPhone = document.getElementById('udmPhone');
    if (elPhone) elPhone.textContent = user.phone ? `+${user.phone}` : 'Not specified';
    const elAppr = document.getElementById('udmApprovalStatus');
    if (elAppr) {
      elAppr.innerHTML = isPending
        ? '<span style="color: #b45309; font-weight: 700;">Pending Admin Approval</span>'
        : (isRejected ? '<span style="color: #dc2626; font-weight: 700;">Rejected</span>' : '<span style="color: #16a34a; font-weight: 700;">Approved</span>');
    }
    const elPlan = document.getElementById('udmPlanName');
    if (elPlan) elPlan.textContent = user.plan || 'Standard Plan';
    const elCreated = document.getElementById('udmCreatedAt');
    if (elCreated) elCreated.textContent = user.createdAt ? new Date(user.createdAt).toLocaleString() : '-';
    const elExpiry = document.getElementById('udmPlanExpiry');
    if (elExpiry) elExpiry.textContent = user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : 'Never (Lifetime)';

    // WhatsApp Instance Section
    const noInstNotice = document.getElementById('udmNoInstanceNotice');
    const instDetailsBox = document.getElementById('udmInstanceDetails');
    const btnPairQr = document.getElementById('udmBtnPairQr');

    if (primaryInstance) {
      noInstNotice?.classList.add('hidden');
      instDetailsBox?.classList.remove('hidden');
      const elIname = document.getElementById('udmInstName');
      if (elIname) elIname.textContent = primaryInstance.name || '-';
      const elIid = document.getElementById('udmInstId');
      if (elIid) elIid.textContent = primaryInstance.id || '-';
      const elIstatus = document.getElementById('udmInstStatus');
      if (elIstatus) {
        elIstatus.innerHTML = primaryInstance.isConnected
          ? '<span style="color: #16a34a; font-weight: 700;">● Online (Connected)</span>'
          : `<span style="color: #f59e0b; font-weight: 700;">● ${primaryInstance.status || 'Offline'}</span>`;
      }
      const elIphone = document.getElementById('udmInstPhone');
      if (elIphone) elIphone.textContent = primaryInstance.phone ? `+${primaryInstance.phone}` : 'Not Linked';
      const elIpush = document.getElementById('udmInstPushname');
      if (elIpush) elIpush.textContent = primaryInstance.pushname || '-';
      const elItoken = document.getElementById('udmInstToken');
      if (elItoken) elItoken.textContent = primaryInstance.accessToken || '-';

      if (btnPairQr) {
        btnPairQr.dataset.instanceId = primaryInstance.id;
        btnPairQr.dataset.instanceName = primaryInstance.name || user.username;
      }
    } else {
      noInstNotice?.classList.remove('hidden');
      instDetailsBox?.classList.add('hidden');
    }

    // Tab 2: User Created Templates
    if (templatesContainer) {
      if (!templates || templates.length === 0) {
        templatesContainer.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
            <div style="font-weight: 700; color: #334155;">No Templates Created Yet</div>
            <p style="font-size: 0.82rem; margin-top: 0.25rem;">This user has not created any WhatsApp message templates in their account.</p>
          </div>
        `;
      } else {
        templatesContainer.innerHTML = templates.map((t) => {
          const vars = Array.isArray(t.variables) ? t.variables : [];
          return `
            <div class="user-template-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div>
                  <h5 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">${escapeHtml(t.name)}</h5>
                  <span style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 600;">${escapeHtml(t.category || 'General')}</span>
                </div>
                <span class="status-pill status-connected" style="font-size: 0.68rem; padding: 0.1rem 0.45rem;">
                  ${t.status || 'Active'}
                </span>
              </div>
              <p style="font-size: 0.82rem; color: #334155; white-space: pre-wrap; background: #fff; padding: 0.6rem; border-radius: 6px; border: 1px solid #e2e8f0; max-height: 110px; overflow-y: auto; font-family: inherit; margin: 0.5rem 0;">${escapeHtml(t.body || t.content || '')}</p>
              ${vars.length > 0 ? `
                <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">
                  <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Variables:</span>
                  ${vars.map(v => `<span style="font-size: 0.7rem; font-family: monospace; background: #eff6ff; color: #1d4ed8; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 600;">{{${escapeHtml(v)}}}</span>`).join('')}
                </div>
              ` : ''}
              <div style="margin-top: 0.6rem; font-size: 0.72rem; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>ID: ${escapeHtml(t._id || t.id || '')}</span>
                <span>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Tab 3: Dispatch Logs
    if (logsTbody) {
      if (!logs || logs.length === 0) {
        logsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">No message dispatch logs recorded for this user yet.</td></tr>`;
      } else {
        logsTbody.innerHTML = logs.slice(0, 50).map((l) => {
          const isSuccess = l.status === 'SENT' || l.status === 'SUCCESS' || l.status === 'DELIVERED';
          return `
            <tr>
              <td style="color: #64748b; white-space: nowrap;">${l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
              <td style="font-weight: 600; font-family: monospace;">+${escapeHtml(l.recipient || l.number || l.phone || '-')}</td>
              <td><span style="font-size: 0.72rem; background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px;">${escapeHtml(l.type || 'text')}</span></td>
              <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(l.message || l.body || '')}">
                ${escapeHtml((l.message || l.body || '-').slice(0, 60))}
              </td>
              <td>
                <span class="status-pill ${isSuccess ? 'status-connected' : 'status-disconnected'}" style="font-size: 0.7rem;">
                  ${escapeHtml(l.status || 'SENT')}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Dispatch stats badge
    const rateBadge = document.getElementById('udmLogsSuccessRateBadge');
    if (rateBadge && stats) {
      const rate = stats.successRate || 100;
      rateBadge.textContent = `${rate}% Success Rate (${stats.sent || 0} sent, ${stats.failed || 0} failed)`;
      rateBadge.style.color = rate >= 90 ? '#16a34a' : '#dc2626';
    }

    // Tab 4: Billing History
    const billingContainer = document.getElementById('udmBillingContainer');
    if (billingContainer) {
      if (!transactions || transactions.length === 0) {
        billingContainer.innerHTML = `<p class="text-secondary" style="padding: 2.5rem 1rem; text-align: center;">No payment transactions recorded for this user.</p>`;
      } else {
        billingContainer.innerHTML = `
          <table class="admin-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Plan / Pack</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => `
                <tr>
                  <td style="font-family: monospace;">${escapeHtml(tx.orderId || tx.id || '-')}</td>
                  <td style="font-weight: 600;">${escapeHtml(tx.planName || 'Standard')}</td>
                  <td style="color: #16a34a; font-weight: 700;">₹${Number(tx.amount || 0).toLocaleString()}</td>
                  <td>${escapeHtml(tx.method || 'Online')}</td>
                  <td style="color: #64748b;">${tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
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

  // Duplicate sessions cleanup handlers
  const handleCleanupDuplicates = async () => {
    if (!confirm('Auto-resolve conflicting WhatsApp sessions? This will disconnect broken/duplicate instances sharing the same phone number and retain only the primary/active session.')) return;
    try {
      const res = await apiFetch('/api/admin/instances/cleanup-duplicates', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to clean duplicate instances.');
      showToast(json.message || 'Duplicate sessions cleaned successfully!', 'success');
      loadInstances();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const btnCleanupDuplicates = document.getElementById('btnCleanupDuplicateInstances');
  if (btnCleanupDuplicates) btnCleanupDuplicates.addEventListener('click', handleCleanupDuplicates);
  const btnQuickClean = document.getElementById('btnQuickCleanDuplicates');
  if (btnQuickClean) btnQuickClean.addEventListener('click', handleCleanupDuplicates);

  // Search & filter listeners
  const instSearch = document.getElementById('instanceSearchInput');
  const instStatus = document.getElementById('instanceStatusFilter');
  const btnRefreshInst = document.getElementById('btnRefreshInstances');

  if (instSearch) instSearch.addEventListener('input', () => filterAndRenderInstances());
  if (instStatus) instStatus.addEventListener('change', () => filterAndRenderInstances());
  if (btnRefreshInst) btnRefreshInst.addEventListener('click', () => loadInstances());
}

async function loadInstances() {
  const instancesList = document.getElementById('instancesList');
  if (!instancesList) return;

  try {
    const res = await apiFetch('/api/admin/instances');
    const json = await res.json();
    if (!res.ok || !json.success) return;

    instancesCache = json.data || [];
    filterAndRenderInstances();
  } catch (err) {
    console.error('Failed to load instances:', err);
  }
}

function filterAndRenderInstances() {
  const container = document.getElementById('instancesList');
  if (!container) return;

  const searchTerm = (document.getElementById('instanceSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('instanceStatusFilter')?.value || 'all';

  // 1. Update KPI Strip Counters
  const total = instancesCache.length;
  const connected = instancesCache.filter(i => i.isConnected).length;
  const pending = instancesCache.filter(i => !i.isConnected && (i.qrReady || i.status === 'QR_READY')).length;
  const duplicates = instancesCache.filter(i => i.hasDuplicatePhone).length;

  const elKpiTotal = document.getElementById('instKpiTotal');
  if (elKpiTotal) elKpiTotal.textContent = total;
  const elKpiConn = document.getElementById('instKpiConnected');
  if (elKpiConn) elKpiConn.textContent = connected;
  const elKpiPending = document.getElementById('instKpiPending');
  if (elKpiPending) elKpiPending.textContent = pending;
  const elKpiDup = document.getElementById('instKpiDuplicates');
  if (elKpiDup) elKpiDup.textContent = duplicates;

  // 2. Alert Banner for Duplicate Phones
  const alertBanner = document.getElementById('duplicateInstancesAlertBanner');
  const bannerText = document.getElementById('duplicateInstancesBannerText');
  if (alertBanner) {
    if (duplicates > 0) {
      alertBanner.classList.remove('hidden');
      if (bannerText) {
        bannerText.textContent = `${duplicates} client instance(s) share conflicting mobile numbers with other accounts. WhatsApp only allows 1 active session per number. Click Auto-Resolve to clean inactive duplicates.`;
      }
    } else {
      alertBanner.classList.add('hidden');
    }
  }

  // 3. Filter Instances List
  let filtered = instancesCache.filter((inst) => {
    const matchesSearch = !searchTerm ||
      (inst.name && inst.name.toLowerCase().includes(searchTerm)) ||
      (inst.id && inst.id.toLowerCase().includes(searchTerm)) ||
      (inst.ownerName && inst.ownerName.toLowerCase().includes(searchTerm)) ||
      (inst.phone && String(inst.phone).includes(searchTerm));

    let matchesStatus = true;
    if (statusFilter === 'connected') {
      matchesStatus = inst.isConnected;
    } else if (statusFilter === 'qr_ready') {
      matchesStatus = !inst.isConnected && (inst.qrReady || inst.status === 'QR_READY');
    } else if (statusFilter === 'disconnected') {
      matchesStatus = !inst.isConnected && !inst.qrReady && inst.status !== 'QR_READY';
    } else if (statusFilter === 'duplicate') {
      matchesStatus = !!inst.hasDuplicatePhone;
    }

    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📱</div>
        <h3 style="margin-bottom: 0.5rem;">No WhatsApp Instances Found</h3>
        <p class="text-secondary" style="max-width: 440px; margin: 0 auto 1.25rem;">
          No instances matched your current search and filter criteria.
        </p>
      </div>
    `;
    return;
  }

  renderInstancesList(filtered);
}

function renderInstancesList(list) {
  const container = document.getElementById('instancesList');
  if (!container) return;

  container.innerHTML = list.map((inst) => {
    let badgeClass = 'badge-idle';
    let statusText = inst.status;
    if (inst.isConnected) {
      badgeClass = 'badge-connected';
      statusText = 'Connected';
    } else if (inst.qrReady || inst.status === 'QR_READY') {
      badgeClass = 'badge-loading';
      statusText = 'QR Ready';
    } else if (inst.status === 'INITIALIZING') {
      badgeClass = 'badge-loading';
      statusText = 'Initializing';
    }

    const hasDuplicate = !!inst.hasDuplicatePhone;

    return `
      <div class="instance-card" style="${hasDuplicate ? 'border: 1.5px solid #fde68a; background: #fffdf5;' : ''}">
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
            <span class="cred-val">
              ${inst.phone ? '+' + inst.phone : '<span class="text-muted">Not Linked</span>'}
            </span>
          </div>
          ${hasDuplicate ? `
          <div style="margin-top: 0.35rem;">
            <span class="duplicate-phone-tag">⚠️ Same Phone Number (${inst.duplicatePhoneCount} conflicting accounts)</span>
          </div>
          ` : ''}
          <div class="cred-row" style="margin-top: 0.35rem;">
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
