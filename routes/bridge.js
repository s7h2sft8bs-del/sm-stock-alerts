const express = require('express');
const router = express.Router();
const pool = require('../db');

// Store pending picks from Project Hope
let pendingPick = null;

// Project Hope sends a pick here
router.post('/incoming-pick', async (req, res) => {
    try {
        const authKey = req.headers['x-bridge-key'];
        if (authKey !== process.env.BRIDGE_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { ticker, company, price, percentChange, entry, takeProfit, stopLoss, sector, setup } = req.body;

        if (!ticker || !price) {
            return res.status(400).json({ error: 'Missing ticker or price' });
        }

        pendingPick = {
            ticker,
            company: company || ticker,
            price: parseFloat(price),
            percentChange: parseFloat(percentChange) || 0,
            entry: parseFloat(entry) || parseFloat(price),
            takeProfit: parseFloat(takeProfit) || null,
            stopLoss: parseFloat(stopLoss) || null,
            sector: sector || 'N/A',
            setup: setup || '',
            receivedAt: new Date().toISOString()
        };

        res.json({ success: true, message: 'Pick received', pick: pendingPick });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process pick' });
    }
});

// Admin checks for pending pick
router.get('/pending-pick', (req, res) => {
    const authPassword = req.headers['x-admin-password'];
    if (authPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ pick: pendingPick });
});

// Clear pending pick after sending
router.delete('/pending-pick', (req, res) => {
    const authPassword = req.headers['x-admin-password'];
    if (authPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    pendingPick = null;
    res.json({ success: true });
});

module.exports = router;
