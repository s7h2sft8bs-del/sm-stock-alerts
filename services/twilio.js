const twilio = require('twilio');
const { pool } = require('../db');

let client;

function initTwilio() {
    client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio initialized');
}

// Send SMS to a single number
async function sendSMS(to, message) {
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        return { success: true, sid: result.sid };
    } catch (err) {
        console.error(`❌ SMS failed to ${to}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Format the alert message
function formatAlertMessage(pick) {
    const arrow = pick.percentChange >= 0 ? '🟢' : '🔴';
    const sign = pick.percentChange >= 0 ? '+' : '';

    return `${pick.direction} SM Stock Alert ${pick.direction}

${pick.ticker} - ${pick.companyName}
💰 $${pick.currentPrice.toFixed(2)} (${sign}${pick.percentChange.toFixed(2)}%)
📊 High: $${pick.high.toFixed(2)} | Low: $${pick.low.toFixed(2)}
🏷️ Sector: ${pick.sector}

${pick.reason}

⚡ Want the full scanner? Reply UPGRADE

Reply STOP to unsubscribe
— SM Digital Solutions`;
}

// Blast alert to all active subscribers
async function sendAlertToAll(pick) {
    const message = formatAlertMessage(pick);

    // Save alert to database
    const alertResult = await pool.query(
        `INSERT INTO alerts (ticker, company_name, alert_price, percent_change, sector, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [pick.ticker, pick.companyName, pick.currentPrice, pick.percentChange, pick.sector, pick.reason]
    );
    const alertId = alertResult.rows[0].id;

    // Get all active subscribers
    const subscribers = await pool.query(
        `SELECT id, phone FROM subscribers WHERE status = 'active'`
    );

    console.log(`📤 Sending alert to ${subscribers.rows.length} subscribers...`);

    let sentCount = 0;
    let failCount = 0;

    for (const sub of subscribers.rows) {
        const result = await sendSMS(sub.phone, message);

        // Log the SMS
        await pool.query(
            `INSERT INTO sms_log (subscriber_id, alert_id, twilio_sid, status)
             VALUES ($1, $2, $3, $4)`,
            [sub.id, alertId, result.sid || null, result.success ? 'sent' : 'failed']
        );

        if (result.success) {
            sentCount++;
        } else {
            failCount++;
        }

        // Small delay to avoid Twilio rate limits
        await new Promise(r => setTimeout(r, 200));
    }

    // Update total sent count
    await pool.query(
        `UPDATE alerts SET total_sent = $1 WHERE id = $2`,
        [sentCount, alertId]
    );

    console.log(`✅ Alert sent: ${sentCount} delivered, ${failCount} failed`);
    return { sentCount, failCount, alertId };
}

// Send welcome message to new subscriber
async function sendWelcome(phone, name) {
    const message = `🎉 Welcome to SM Stock Alerts${name ? ', ' + name : ''}!

You'll receive 1 FREE stock pick every market morning before open.

Our scanner analyzes 40+ stocks to find the biggest movers so you don't have to.

Want more? The full SM Stock Scanner is coming soon. Stay tuned! 🚀

— SM Digital Solutions
Reply STOP to unsubscribe`;

    return await sendSMS(phone, message);
}

module.exports = { initTwilio, sendSMS, sendAlertToAll, sendWelcome, formatAlertMessage };
