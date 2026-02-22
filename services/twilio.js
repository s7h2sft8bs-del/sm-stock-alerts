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

function formatAlertMessage(pick) {
    const sign = pick.percentChange >= 0 ? '+' : '';
    const price = pick.currentPrice ? parseFloat(pick.currentPrice).toFixed(2) : pick.price ? parseFloat(pick.price).toFixed(2) : '0.00';

    let msg = `SM Alert: ${pick.ticker} $${price} (${sign}${parseFloat(pick.percentChange).toFixed(2)}%)`;

    if (pick.entry) msg += `\nEntry $${parseFloat(pick.entry).toFixed(2)}`;
    if (pick.takeProfit) msg += ` | TP $${parseFloat(pick.takeProfit).toFixed(2)}`;
    if (pick.stopLoss) msg += ` | SL $${parseFloat(pick.stopLoss).toFixed(2)}`;

    if (pick.reason || pick.setup) msg += `\n${(pick.reason || pick.setup).substring(0, 60)}`;

    msg += '\n-SM Digital | STOP to unsub';
    return msg;
}

async function sendAlertToAll(pick) {
    const message = formatAlertMessage(pick);

    const alertResult = await pool.query(
        `INSERT INTO alerts (ticker, company_name, alert_price, percent_change, sector, reason)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [pick.ticker, pick.companyName || pick.ticker, pick.currentPrice || pick.price, pick.percentChange, pick.sector, pick.reason]
    );
    const alertId = alertResult.rows[0].id;

    const subscribers = await pool.query(
        `SELECT id, phone FROM subscribers WHERE status = 'active'`
    );

    console.log(`📤 Sending alert to ${subscribers.rows.length} subscribers...`);

    let sentCount = 0;
    let failCount = 0;

    for (const sub of subscribers.rows) {
        const result = await sendSMS(sub.phone, message);

        await pool.query(
            `INSERT INTO sms_log (subscriber_id, alert_id, twilio_sid, status)
             VALUES ($1, $2, $3, $4)`,
            [sub.id, alertId, result.sid || null, result.success ? 'sent' : 'failed']
        );

        if (result.success) sentCount++;
        else failCount++;

        await new Promise(r => setTimeout(r, 200));
    }

    await pool.query(
        `UPDATE alerts SET total_sent = $1 WHERE id = $2`,
        [sentCount, alertId]
    );

    console.log(`✅ Alert sent: ${sentCount} delivered, ${failCount} failed`);
    return { sentCount, failCount, alertId };
}

async function sendWelcome(phone, name) {
    const msg = `Welcome to SM Stock Alerts${name ? ' ' + name : ''}! Free stock pick every market morning. -SM Digital | STOP to unsub`;
    return await sendSMS(phone, msg);
}

module.exports = { initTwilio, sendSMS, sendAlertToAll, sendWelcome, formatAlertMessage };
