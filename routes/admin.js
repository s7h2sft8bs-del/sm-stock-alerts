const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { scanForTopMover, getMarketOverview } = require('../services/finnhub');
const { sendAlertToAll, sendSMS } = require('../services/twilio');

// Simple admin auth middleware
function adminAuth(req, res, next) {
    const password = req.headers['x-admin-password'] || req.query.password;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// GET /api/admin/dashboard - Admin dashboard data
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const subscribers = await pool.query(
            `SELECT status, COUNT(*) as count FROM subscribers GROUP BY status`
        );

        const recentAlerts = await pool.query(
            `SELECT * FROM alerts ORDER BY sent_at DESC LIMIT 10`
        );

        const todaySignups = await pool.query(
            `SELECT COUNT(*) as count FROM subscribers WHERE created_at::date = CURRENT_DATE`
        );

        const totalSMS = await pool.query(
            `SELECT COUNT(*) as count FROM sms_log`
        );

        const market = await getMarketOverview();

        res.json({
            subscribers: subscribers.rows,
            recentAlerts: recentAlerts.rows,
            todaySignups: parseInt(todaySignups.rows[0].count),
            totalSMS: parseInt(totalSMS.rows[0].count),
            market
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Could not load dashboard' });
    }
});

// POST /api/admin/scan - Run scanner manually
router.post('/scan', adminAuth, async (req, res) => {
    try {
        const pick = await scanForTopMover();
        if (!pick) {
            return res.status(404).json({ error: 'No picks found. Market may be closed.' });
        }
        res.json({ pick });
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ error: 'Scanner failed' });
    }
});

// POST /api/admin/send-alert - Send alert to all subscribers
router.post('/send-alert', adminAuth, async (req, res) => {
    try {
        // Option 1: Auto-pick from scanner
        // Option 2: Manual pick from request body
        let pick;

        if (req.body.ticker) {
            // Manual pick
            pick = {
                ticker: req.body.ticker,
                companyName: req.body.companyName || req.body.ticker,
                sector: req.body.sector || 'N/A',
                currentPrice: parseFloat(req.body.currentPrice),
                percentChange: parseFloat(req.body.percentChange),
                change: parseFloat(req.body.change || 0),
                high: parseFloat(req.body.high || req.body.currentPrice),
                low: parseFloat(req.body.low || req.body.currentPrice),
                direction: parseFloat(req.body.percentChange) >= 0 ? '📈' : '📉',
                reason: req.body.reason || 'Hand-picked by SM Digital Solutions'
            };
        } else {
            // Auto scanner pick
            pick = await scanForTopMover();
            if (!pick) {
                return res.status(404).json({ error: 'No picks found. Try manual entry.' });
            }
        }

        const result = await sendAlertToAll(pick);
        res.json({
            message: `Alert sent successfully!`,
            pick,
            ...result
        });
    } catch (err) {
        console.error('Send alert error:', err);
        res.status(500).json({ error: 'Failed to send alert' });
    }
});

// GET /api/admin/subscribers - List all subscribers
router.get('/subscribers', adminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, phone, name, email, status, source, created_at 
             FROM subscribers ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Could not load subscribers' });
    }
});

// POST /api/admin/test-sms - Send test SMS to a specific number
router.post('/test-sms', adminAuth, async (req, res) => {
    try {
        const { phone, message } = req.body;
        const result = await sendSMS(phone, message || '🧪 Test alert from SM Stock Alerts!');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Test SMS failed' });
    }
});


// DELETE /api/admin/subscriber/:id
router.delete("/subscriber/:id", adminAuth, async (req, res) => {
    try {
        await pool.query("DELETE FROM sms_log WHERE subscriber_id = $1", [req.params.id]);
        const result = await pool.query("DELETE FROM subscribers WHERE id = $1 RETURNING phone", [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Deleted " + result.rows[0].phone });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});
module.exports = router;
