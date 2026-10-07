const { ObjectId } = require('mongodb');
const { getDatabase } = require('../services/databaseService');
const { publicUser, AVAILABLE_PLANS } = require('../services/userAuthService');
const instanceService = require('../services/instanceService');
const logService = require('../services/logService');
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
      const activeUsers = users.filter((u) => u.status === 'active' || !u.status).length;
      const inactiveUsers = users.filter((u) => u.status === 'inactive').length;

      // WhatsApp instances stats
      const instances = instanceService.getAllInstances();
      const totalInstances = instances.length;
      const connectedInstances = instances.filter((i) => i.isConnected).length;
      const pendingQrInstances = instances.filter((i) => i.qrReady && !i.isConnected).length;

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
            inactive: inactiveUsers
          },
          instances: {
            total: totalInstances,
            connected: connectedInstances,
            pendingQr: pendingQrInstances
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
   * List all registered users enriched with instance, plan, and quota details
   */
  async getUsers(req, res) {
    try {
      const db = await getDatabase();
      const users = await db.collection('users')
        .find({}, { projection: { passwordHash: 0, passwordSalt: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      const enriched = users.map((u) => {
        const userObj = publicUser(u);
        const instances = instanceService.getInstancesForUser(u._id);
        const primaryInst = instances[0] || null;

        const quota = typeof u.messageQuota === 'number' ? u.messageQuota : 2500;
        const used = typeof u.messagesUsed === 'number' ? u.messagesUsed : 0;
        const remaining = Math.max(0, quota - used);

        return {
          ...userObj,
          status: u.status || 'active',
          plan: u.plan || 'Pro SaaS Plan',
          planStatus: u.planStatus || 'active',
          messageQuota: quota,
          messagesUsed: used,
          creditsRemaining: remaining,
          planExpiresAt: u.planExpiresAt || null,
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
   * Get global WhatsApp instances with owner user names
   */
  async getInstances(req, res) {
    try {
      const list = instanceService.getAllInstances();
      const db = await getDatabase();
      const users = await db.collection('users').find({}, { projection: { fullName: 1, username: 1, email: 1 } }).toArray();
      const userMap = new Map(users.map((u) => [u._id.toString(), u]));

      const enriched = list.map((inst) => {
        const owner = inst.ownerUserId ? userMap.get(inst.ownerUserId) : null;
        return {
          ...inst,
          ownerName: owner ? (owner.fullName || owner.username) : (inst.isDefault ? 'Admin / Default' : 'Unassigned'),
          ownerEmail: owner ? owner.email : null
        };
      });

      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error('[AdminController] Get instances error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve instances.' });
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
