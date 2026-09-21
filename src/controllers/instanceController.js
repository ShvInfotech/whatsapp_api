const instanceService = require('../services/instanceService');

class InstanceController {
  /**
   * List all instances (Admin)
   */
  async list(req, res) {
    try {
      const instances = instanceService.getAllInstances();
      return res.json({ success: true, data: instances });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Create a new instance (Admin)
   */
  async create(req, res) {
    try {
      const { name } = req.body;
      const instance = await instanceService.createInstance(name);
      return res.status(201).json({
        success: true,
        message: 'Instance created successfully.',
        data: instance
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Get QR & connection status for an instance (Admin)
   */
  async getQr(req, res) {
    try {
      const { id } = req.params;
      const qrInfo = await instanceService.getInstanceQr(id);
      if (!qrInfo) {
        return res.status(404).json({ success: false, error: 'Instance not found.' });
      }
      return res.json({ success: true, data: qrInfo });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Reset session and generate fresh QR for an instance (Admin)
   */
  async reset(req, res) {
    try {
      const { id } = req.params;
      const result = await instanceService.resetInstanceSession(id);
      return res.json({
        success: true,
        message: 'Instance session reset. Generating fresh QR code...',
        data: result ? instanceService.serializeInstance(result) : null
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Delete an instance (Admin)
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      await instanceService.deleteInstance(id);
      return res.json({ success: true, message: `Instance ${id} deleted successfully.` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Public QR endpoint for client standalone pairing page
   * GET /api/public/instance-qr?instance_id=679B485A1510B
   */
  async publicQr(req, res) {
    try {
      const instanceId = req.query.instance_id || req.query.id;
      if (!instanceId) {
        return res.status(400).json({ success: false, error: "Missing 'instance_id' parameter." });
      }

      const record = instanceService.getInstanceRecord(instanceId);
      if (!record) {
        return res.status(404).json({ success: false, error: 'Instance not found.' });
      }

      const qrInfo = await instanceService.getInstanceQr(instanceId);
      return res.json({
        success: true,
        data: {
          id: record.id,
          name: record.name,
          status: qrInfo.status,
          isConnected: qrInfo.isConnected,
          qrReady: qrInfo.qrReady,
          qrDataUrl: qrInfo.qrDataUrl,
          phone: qrInfo.phone,
          pushname: qrInfo.pushname
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new InstanceController();
