const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../services/databaseService');
const { publicUser, AVAILABLE_PLANS, approveUser, rejectUser, updateUserStatus } = require('../services/userAuthService');
const instanceService = require('../services/instanceService');
const logService = require('../services/logService');
const templateService = require('../services/templateService');
const transactionService = require('../services/transactionService');

class AdminController {
  /**
   * Aggregate high-level dashboard metrics & KPIs
   */
  async getDashboardStats(req, res) {
    try {
      const db = await getDatabase();
      const users = await db.collection('users').find({}).toArray();
      const totalUsers = users.length;
      const pendingUsers = users.filter((u) => u.status === 'pending' || u.isApproved === false).length;
      const activeUsers = users.filter((u) => (u.status === 'active' || (!u.status && u.isApproved !== false)) && u.status !== 'pending').length;
      const inactiveUsers = users.filter((u) => u.status === 'inactive' || u.status === 'suspended').length;

      // WhatsApp instances stats
      const instances = instanceService.getAllInstances();
      const totalInstances = instances.length;
      const connectedInstances = instances.filter((i) => i.isConnected).length;
      const pendingQrInstances = instances.filter((i) => i.qrReady && !i.isConnected).length;

      // Count duplicate phones
      const phoneCountMap = new Map();
      instances.forEach((inst) => {
        if (inst.phone) {
          const p = String(inst.phone).trim();
          phoneCountMap.set(p, (phoneCountMap.get(p) || 0) + 1);
        }
      });
      const duplicatePhoneCount = Array.from(phoneCountMap.values()).filter((c) => c > 1).length;

      // Dispatch statistics from logs
      const allLogs = logService.getUserLogs(null, 1000);
      const todayStr = new Date().toISOString().slice(0, 10);
      const totalDispatches = allLogs.length;
      const sentToday = allLogs.filter((l) => l.status === 'sent' && l.timestamp.startsWith(todayStr)).length;
      const successful = allLogs.filter((l) => l.status === 'sent').length;
      const successRate = totalDispatches > 0 ? Math.round((successful / totalDispatches) * 100) : 100;

      // Revenue statistics
      const revenueStats = await transactionService.getRevenueStats();

      // Recent 8 dispatches across system
      const recentActivity = allLogs.slice(0, 8);

      return res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            pending: pendingUsers,
            inactive: inactiveUsers
          },
          instances: {
            total: totalInstances,
            connected: connectedInstances,
            pendingQr: pendingQrInstances,
            duplicatePhones: duplicatePhoneCount
          },
          dispatches: {
            total: totalDispatches,
            today: sentToday,
            successful,
            successRate
          },
          revenue: revenueStats,
          recentActivity
        }
      });
    } catch (err) {
      console.error('[AdminController] Dashboard stats error:', err);
      return res.status(500).json({ success: false, error: 'Failed to aggregate dashboard statistics.' });
    }
  }

  /**
   * List all registered users enriched with instance, plan, quota, and template counts
   */
  async getUsers(req, res) {
    try {
      const db = await getDatabase();
      const users = await db.collection('users')
        .find({}, { projection: { passwordHash: 0, passwordSalt: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      // Aggregate template counts per user
      let tplCountMap = new Map();
      try {
        const templateCounts = await db.collection('templates').aggregate([
          { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]).toArray();
        tplCountMap = new Map(templateCounts.map((t) => [t._id, t.count]));
      } catch (_) {}

      const enriched = users.map((u) => {
        const userObj = publicUser(u);
        const uid = u._id.toString();
        const instances = instanceService.getInstancesForUser(u._id);
        const primaryInst = instances[0] || null;

        const quota = typeof u.messageQuota === 'number' ? u.messageQuota : 2500;
        const used = typeof u.messagesUsed === 'number' ? u.messagesUsed : 0;
        const remaining = Math.max(0, quota - used);

        return {
          ...userObj,
          status: u.status || (u.isApproved === false ? 'pending' : 'active'),
          isApproved: u.isApproved !== undefined ? u.isApproved : (u.status === 'active'),
          plan: u.plan || 'Pro SaaS Plan',
          planStatus: u.planStatus || 'active',
          messageQuota: quota,
          messagesUsed: used,
          creditsRemaining: remaining,
          planExpiresAt: u.planExpiresAt || null,
          templateCount: tplCountMap.get(uid) || 0,
          hasInstance: Boolean(primaryInst),
          instance: primaryInst ? {
            id: primaryInst.id,
            name: primaryInst.name,
            isConnected: primaryInst.isConnected,
            status: primaryInst.status,
            phone: primaryInst.phone || null,
            pushname: primaryInst.pushname || null,
            accessToken: primaryInst.accessToken || null
          } : null
        };
      });

      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error('[AdminController] Get users error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve users.' });
    }
  }

  /**
   * Admin direct user creation with auto-approval and instance provisioning
   */
  async createUser(req, res) {
    try {
      const { fullName, username, email, phone, password, plan } = req.body || {};
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Username, email and password are required.' });
      }

      const db = await getDatabase();
      const existing = await db.collection('users').findOne({
        $or: [{ username: username.toLowerCase().trim() }, { email: email.toLowerCase().trim() }]
      });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username or email already registered.' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const planName = plan || 'Pro SaaS Plan';
      const quota = planName.includes('Starter') ? 5000 : (planName.includes('Agency') ? 10000 : 2500);

      const newUser = {
        fullName: (fullName || username).trim(),
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        phone: phone ? String(phone).trim() : '',
        passwordHash: hash,
        passwordSalt: salt,
        role: 'user',
        status: 'active',
        isApproved: true,
        approvedAt: new Date().toISOString(),
        plan: planName,
        messageQuota: quota,
        messagesUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await db.collection('users').insertOne(newUser);
      newUser._id = result.insertedId;

      try {
        await instanceService.createInstance(newUser._id, `${newUser.username}_wa`);
      } catch (_) {}

      return res.status(201).json({ success: true, message: `User '${newUser.username}' created successfully!`, data: publicUser(newUser) });
    } catch (err) {
      console.error('[AdminController] Create user error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to create user.' });
    }
  }

  /**
   * Manual credit adjustment (Add or Set credits)
   */
  async updateUserCredits(req, res) {
    try {
      const { userId, amount, mode = 'add', reason = 'Admin manual adjustment' } = req.body || {};
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'A valid positive credit amount is required.' });
      }

      const db = await getDatabase();
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const currentQuota = typeof user.messageQuota === 'number' ? user.messageQuota : 2500;
      const newQuota = mode === 'set' ? numAmount : currentQuota + numAmount;

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            messageQuota: newQuota,
            updatedAt: new Date().toISOString()
          }
        }
      );

      // Record administrative top-up transaction
      await transactionService.recordTransaction({
        userId: user._id,
        userName: user.fullName || user.username,
        userEmail: user.email,
        planId: 'admin_topup',
        planName: `Admin Credit Top-up (+${numAmount.toLocaleString()} Credits)`,
        amount: 0,
        currency: 'INR',
        creditsAdded: numAmount,
        status: 'captured',
        method: 'Admin Manual Credit Grant'
      });

      return res.json({
        success: true,
        message: `Successfully updated credits for ${user.fullName || user.username}. New quota: ${newQuota.toLocaleString()}`,
        data: {
          userId,
          previousQuota: currentQuota,
          newQuota
        }
      });
    } catch (err) {
      console.error('[AdminController] Update credits error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update user credits.' });
    }
  }

  /**
   * Change user subscription plan
   */
  async updateUserPlan(req, res) {
    try {
      const { userId, planKey, customQuota, customDays } = req.body || {};
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const db = await getDatabase();
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const planInfo = AVAILABLE_PLANS[planKey];
      let planName = 'Custom SaaS Plan';
      let quota = typeof customQuota === 'number' ? customQuota : 5000;
      let days = typeof customDays === 'number' ? customDays : 30;

      if (planInfo) {
        planName = planInfo.name;
        quota = planInfo.quota || (user.messageQuota || 2500) + (planInfo.addQuota || 0);
        days = planInfo.days || 30;
      }

      const planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            plan: planName,
            messageQuota: quota,
            planExpiresAt,
            planStatus: 'active',
            status: 'active',
            updatedAt: new Date().toISOString()
          }
        }
      );

      // Record administrative plan adjustment
      await transactionService.recordTransaction({
        userId: user._id,
        userName: user.fullName || user.username,
        userEmail: user.email,
        planId: planKey || 'custom',
        planName: `Admin Plan Assignment (${planName})`,
        amount: planInfo ? planInfo.price : 0,
        currency: 'INR',
        creditsAdded: quota,
        status: 'captured',
        method: 'Admin Plan Assignment'
      });

      return res.json({
        success: true,
        message: `Plan changed to '${planName}' for ${user.fullName || user.username}.`,
        data: {
          userId,
          plan: planName,
          messageQuota: quota,
          planExpiresAt
        }
      });
    } catch (err) {
      console.error('[AdminController] Update plan error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update user plan.' });
    }
  }

  /**
   * Toggle user account status (Active / Inactive)
   */
  async toggleUserStatus(req, res) {
    try {
      const { userId, status } = req.body || {};
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const newStatus = status === 'inactive' ? 'inactive' : 'active';
      const db = await getDatabase();
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: newStatus,
            statusUpdatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after', projection: { passwordHash: 0, passwordSalt: 0 } }
      );

      if (!result) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      return res.json({
        success: true,
        message: `User status set to ${newStatus.toUpperCase()}.`,
        data: publicUser(result)
      });
    } catch (err) {
      console.error('[AdminController] Toggle status error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update user status.' });
    }
  }

  /**
   * Force reset a user's WhatsApp instance session
   */
  async resetUserSession(req, res) {
    try {
      const { userId } = req.body || {};
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const instances = instanceService.getInstancesForUser(userId);
      if (!instances.length) {
        return res.status(404).json({ success: false, error: 'No WhatsApp instance found for this user.' });
      }

      const inst = instances[0];
      await instanceService.resetInstanceSession(inst.id);

      return res.json({
        success: true,
        message: `Session for instance '${inst.name}' has been cleared and reset. Client will need to re-scan QR.`
      });
    } catch (err) {
      console.error('[AdminController] Reset session error:', err);
      return res.status(500).json({ success: false, error: 'Failed to reset instance session.' });
    }
  }

  /**
   * Delete a user account and remove their WhatsApp instance
   */
  async deleteUser(req, res) {
    try {
      const userId = req.params.id || req.body.userId;
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      // Cleanup user's WhatsApp instance first
      const instances = instanceService.getInstancesForUser(userId);
      for (const inst of instances) {
        try {
          await instanceService.deleteInstance(inst.id);
        } catch (_) {}
      }

      const db = await getDatabase();
      const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, error: 'User not found or already deleted.' });
      }

      return res.json({
        success: true,
        message: 'User account and associated WhatsApp instance have been permanently removed.'
      });
    } catch (err) {
      console.error('[AdminController] Delete user error:', err);
      return res.status(500).json({ success: false, error: 'Failed to delete user.' });
    }
  }

  /**
   * Get all Razorpay / billing transactions
   */
  async getTransactions(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      const transactions = await transactionService.getAllTransactions(limit);
      return res.json({ success: true, data: transactions });
    } catch (err) {
      console.error('[AdminController] Get transactions error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve transactions.' });
    }
  }

  /**
   * Get complete user history, templates, instance, and dispatch logs for tracking
   */
  async getUserDetails(req, res) {
    try {
      const userId = req.params.id;
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const db = await getDatabase();
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { passwordHash: 0, passwordSalt: 0 } }
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const uid = user._id.toString();
      const userObj = publicUser(user);

      // WhatsApp Instances owned by user
      const instances = instanceService.getInstancesForUser(uid);

      // All templates created by this specific user
      const templates = await templateService.getTemplates(uid);

      // Message logs & stats for this user
      const logs = logService.getUserLogs(uid, 60);
      const stats = logService.getUserStats(uid);

      // Razorpay billing transactions
      let transactions = [];
      try {
        transactions = await transactionService.getTransactionsByUser(user._id);
      } catch (_) {}

      return res.json({
        success: true,
        data: {
          user: {
            ...userObj,
            isApproved: user.isApproved !== undefined ? user.isApproved : (user.status === 'active'),
            status: user.status || 'active',
            rejectionReason: user.rejectionReason || null,
            approvedAt: user.approvedAt || null
          },
          instances,
          primaryInstance: instances[0] || null,
          templates,
          logs,
          stats,
          transactions
        }
      });
    } catch (err) {
      console.error('[AdminController] Get user details error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve user details & history.' });
    }
  }

  /**
   * Approve a pending user account
   */
  async approveUser(req, res) {
    try {
      const userId = req.params.id || req.body.userId;
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const db = await getDatabase();
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'active',
            isApproved: true,
            planStatus: 'active',
            approvedAt: new Date().toISOString(),
            statusUpdatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after', projection: { passwordHash: 0, passwordSalt: 0 } }
      );

      if (!result) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      // Ensure WhatsApp instance exists for approved user
      await instanceService.ensureUserInstance(result);

      return res.json({
        success: true,
        message: `User '${result.fullName || result.username}' approved successfully! They can now log in.`,
        data: publicUser(result)
      });
    } catch (err) {
      console.error('[AdminController] Approve user error:', err);
      return res.status(500).json({ success: false, error: 'Failed to approve user.' });
    }
  }

  /**
   * Reject a pending user account
   */
  async rejectUser(req, res) {
    try {
      const userId = req.params.id || req.body.userId;
      const reason = req.body?.reason || 'Administrator rejection';
      if (!userId || !ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: 'Valid user ID is required.' });
      }

      const db = await getDatabase();
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: 'rejected',
            isApproved: false,
            rejectionReason: reason,
            statusUpdatedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after', projection: { passwordHash: 0, passwordSalt: 0 } }
      );

      if (!result) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      return res.json({
        success: true,
        message: `User '${result.fullName || result.username}' registration rejected.`,
        data: publicUser(result)
      });
    } catch (err) {
      console.error('[AdminController] Reject user error:', err);
      return res.status(500).json({ success: false, error: 'Failed to reject user.' });
    }
  }

  /**
   * Get global WhatsApp instances with owner user names & duplicate phone detection
   */
  async getInstances(req, res) {
    try {
      const list = instanceService.getAllInstances();
      const db = await getDatabase();
      const users = await db.collection('users').find({}, { projection: { fullName: 1, username: 1, email: 1 } }).toArray();
      const userMap = new Map(users.map((u) => [u._id.toString(), u]));

      // Count occurrences per phone number to detect duplicate/shared instances
      const phoneCountMap = new Map();
      list.forEach((inst) => {
        if (inst.phone) {
          const p = String(inst.phone).trim();
          phoneCountMap.set(p, (phoneCountMap.get(p) || 0) + 1);
        }
      });

      const enriched = list.map((inst) => {
        const owner = inst.ownerUserId ? userMap.get(inst.ownerUserId) : null;
        const phone = inst.phone ? String(inst.phone).trim() : null;
        const phoneInstancesCount = phone ? (phoneCountMap.get(phone) || 0) : 0;
        const hasDuplicatePhone = phoneInstancesCount > 1;

        return {
          ...inst,
          ownerName: owner ? (owner.fullName || owner.username) : (inst.isDefault ? 'Admin / Default' : 'Unassigned'),
          ownerEmail: owner ? owner.email : null,
          hasDuplicatePhone,
          duplicatePhoneCount: phoneInstancesCount
        };
      });

      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error('[AdminController] Get instances error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve instances.' });
    }
  }

  /**
   * Clean up stale duplicate instances sharing the same mobile number
   */
  async cleanupDuplicateInstances(req, res) {
    try {
      const list = instanceService.getAllInstances();
      // Group non-default instances by phone number
      const phoneGroups = new Map();
      for (const inst of list) {
        if (inst.isDefault || !inst.phone) continue;
        const p = String(inst.phone).trim();
        if (!phoneGroups.has(p)) phoneGroups.set(p, []);
        phoneGroups.get(p).push(inst);
      }

      let cleanedCount = 0;
      const details = [];

      for (const [phone, group] of phoneGroups.entries()) {
        if (group.length > 1) {
          // Keep the actively connected instance if one exists, otherwise the first
          const connectedInst = group.find((i) => i.isConnected) || group[0];
          for (const duplicate of group) {
            if (duplicate.id === connectedInst.id) continue;
            try {
              instanceService.updateInstanceRecord(duplicate.id, {
                phone: null,
                pushname: null,
                status: 'DISCONNECTED',
                isConnected: false,
                qrReady: false
              });
              cleanedCount++;
              details.push(`Cleared conflicting phone +${phone} from instance '${duplicate.name}' (${duplicate.id})`);
            } catch (_) {}
          }
        }
      }

      return res.json({
        success: true,
        message: cleanedCount > 0
          ? `Successfully cleaned ${cleanedCount} duplicate phone session references.`
          : 'No duplicate phone numbers found across active instances.',
        cleanedCount,
        details
      });
    } catch (err) {
      console.error('[AdminController] Cleanup duplicate instances error:', err);
      return res.status(500).json({ success: false, error: 'Failed to cleanup duplicate instances.' });
    }
  }

  /**
   * Get plans and booster configurations
   */
  getPlansConfig(req, res) {
    return res.json({
      success: true,
      data: AVAILABLE_PLANS
    });
  }
}

module.exports = new AdminController();
