const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100),
                email VARCHAR(255),
                status VARCHAR(20) DEFAULT 'active',
                source VARCHAR(50) DEFAULT 'landing_page',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                ticker VARCHAR(10) NOT NULL,
                company_name VARCHAR(255),
                alert_price DECIMAL(10,2),
                percent_change DECIMAL(8,4),
                volume BIGINT,
                sector VARCHAR(100),
                reason TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_sent INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sms_log (
                id SERIAL PRIMARY KEY,
                subscriber_id INTEGER REFERENCES subscribers(id),
                alert_id INTEGER REFERENCES alerts(id),
                twilio_sid VARCHAR(100),
                status VARCHAR(20) DEFAULT 'sent',
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scanner_waitlist (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database tables initialized');
    } catch (err) {
        console.error('❌ Database init error:', err.message);
    } finally {
        client.release();
    }
}

module.exports = { pool, initDB };
