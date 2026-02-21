const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { sendWelcome } = require('../services/twilio');

// Format phone number to E.164
function formatPhone(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = '1' + cleaned;
    }
    return '+' + cleaned;
}

// POST /api/subscribe - New subscriber signup
router.post('/subscribe', async (req, res) => {
    try {
        let { phone, name, email, source } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        phone = formatPhone(phone);

        // Validate phone format
        if (!/^\+1\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Please enter a valid US phone number' });
        }

        // Check if already subscribed
        const existing = await pool.query(
            'SELECT id, status FROM subscribers WHERE phone = $1',
            [phone]
        );

        if (existing.rows.length > 0) {
            if (existing.rows[0].status === 'active') {
                return res.status(409).json({ error: 'This number is already subscribed!' });
            }
            // Reactivate
            await pool.query(
                `UPDATE subscribers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE phone = $1`,
                [phone]
            );
            await sendWelcome(phone, name);
            return res.json({ message: 'Welcome back! Your subscription has been reactivated.' });
        }

        // Insert new subscriber
        await pool.query(
            `INSERT INTO subscribers (phone, name, email, source) VALUES ($1, $2, $3, $4)`,
            [phone, name || null, email || null, source || 'landing_page']
        );

        // Send welcome SMS
        await sendWelcome(phone, name);

        res.json({ message: 'You\'re in! Check your phone for a welcome message. 🚀' });

    } catch (err) {
        console.error('Subscribe error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// POST /api/unsubscribe - Unsubscribe
router.post('/unsubscribe', async (req, res) => {
    try {
        let { phone } = req.body;
        phone = formatPhone(phone);

        await pool.query(
            `UPDATE subscribers SET status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE phone = $1`,
            [phone]
        );

        res.json({ message: 'You have been unsubscribed. Sorry to see you go!' });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        res.status(500).json({ error: 'Something went wrong.' });
    }
});

// Twilio webhook for incoming messages (STOP/START)
router.post('/webhook/sms', async (req, res) => {
    const { Body, From } = req.body;
    const message = (Body || '').trim().toUpperCase();

    if (message === 'STOP') {
        await pool.query(
            `UPDATE subscribers SET status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE phone = $1`,
            [From]
        );
    } else if (message === 'START' || message === 'SUBSCRIBE') {
        await pool.query(
            `UPDATE subscribers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE phone = $1`,
            [From]
        );
    }

    // Twilio expects TwiML response
    res.type('text/xml');
    res.send('<Response></Response>');
});

// GET /api/stats - Public stats (for landing page social proof)
router.get('/stats', async (req, res) => {
    try {
        const subCount = await pool.query(
            `SELECT COUNT(*) as total FROM subscribers WHERE status = 'active'`
        );
        const alertCount = await pool.query(
            `SELECT COUNT(*) as total FROM alerts`
        );
        const lastAlert = await pool.query(
            `SELECT ticker, company_name, percent_change, sent_at FROM alerts ORDER BY sent_at DESC LIMIT 1`
        );

        res.json({
            subscribers: parseInt(subCount.rows[0].total),
            alertsSent: parseInt(alertCount.rows[0].total),
            lastAlert: lastAlert.rows[0] || null
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not load stats' });
    }
});

module.exports = router;
