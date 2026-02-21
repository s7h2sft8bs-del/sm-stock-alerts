require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');

const { initDB } = require('./db');
const { initTwilio, sendAlertToAll } = require('./services/twilio');
const { scanForTopMover } = require('./services/finnhub');
const subscriberRoutes = require('./routes/subscribers');
const adminRoutes = require('./routes/admin');
const marketRoutes = require('./routes/market');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for subscribe endpoint
const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many signup attempts. Please try again later.' }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', subscriberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', marketRoutes);
app.use('/api/subscribe', subscribeLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================
// CRON: Auto-send daily alert at 9:00 AM ET
// Monday-Friday only (market days)
// ============================================
cron.schedule('0 9 * * 1-5', async () => {
    console.log('⏰ Running scheduled morning scan...');
    try {
        const pick = await scanForTopMover();
        if (pick) {
            const result = await sendAlertToAll(pick);
            console.log(`📱 Morning alert complete: ${result.sentCount} sent for ${pick.ticker}`);
        } else {
            console.log('⚠️ No picks found for morning alert');
        }
    } catch (err) {
        console.error('❌ Scheduled alert failed:', err.message);
    }
}, {
    timezone: process.env.TIMEZONE || 'America/New_York'
});

// Initialize and start
async function start() {
    await initDB();
    initTwilio();

    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════╗
║        SM STOCK ALERTS - LIVE           ║
║   by SM Digital Solutions               ║
║                                         ║
║   🌐  http://localhost:${PORT}             ║
║   📊  Admin: /admin                     ║
║   ⏰  Daily alert: 9:00 AM ET (M-F)    ║
╚══════════════════════════════════════════╝
        `);
    });
}

start();
