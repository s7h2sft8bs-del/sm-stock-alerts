# SM Stock Alerts
### By SM Digital Solutions

Free daily stock pick via SMS. Built to grow an audience, then upsell to the full SM Stock Scanner and Project Hope.

---

## 🚀 Quick Deploy to Render

### Step 1: Create PostgreSQL Database
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **PostgreSQL**
3. Name: `sm-stock-alerts-db`
4. Plan: **Free**
5. Click **Create Database**
6. Copy the **Internal Database URL**

### Step 2: Get API Keys

**Finnhub (Free):**
1. Go to [finnhub.io](https://finnhub.io)
2. Sign up for free
3. Copy your API key from the dashboard

**Twilio (Pay-as-you-go):**
1. Go to [twilio.com](https://www.twilio.com)
2. Sign up and verify your phone number
3. Buy a phone number (~$1.15/month)
4. Copy: Account SID, Auth Token, and your Twilio phone number
5. SMS costs ~$0.0079 per message

### Step 3: Deploy Web Service
1. Push this code to a GitHub repo
2. In Render, click **New** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name:** `sm-stock-alerts`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

### Step 4: Set Environment Variables
In your Render web service, add these env vars:

```
DATABASE_URL=<your internal database URL from step 1>
TWILIO_ACCOUNT_SID=<your Twilio SID>
TWILIO_AUTH_TOKEN=<your Twilio auth token>
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
FINNHUB_API_KEY=<your Finnhub key>
ADMIN_PASSWORD=<choose a strong password>
TIMEZONE=America/New_York
NODE_ENV=production
```

### Step 5: Initialize Database
The database tables auto-create on first startup.

---

## 📁 Project Structure

```
sm-stock-alerts/
├── server.js              # Main entry + cron scheduler
├── package.json
├── .env.example
├── db/
│   ├── index.js           # Database connection + init
│   └── schema.sql         # Full schema reference
├── services/
│   ├── finnhub.js         # Stock scanner (Finnhub API)
│   └── twilio.js          # SMS messaging (Twilio)
├── routes/
│   ├── subscribers.js     # Public API (subscribe, unsubscribe)
│   └── admin.js           # Admin API (dashboard, send alerts)
└── public/
    ├── index.html          # Landing page
    └── admin.html          # Admin dashboard
```

---

## 🔗 Endpoints

### Public
- `GET /` — Landing page
- `POST /api/subscribe` — New subscriber signup
- `POST /api/unsubscribe` — Unsubscribe
- `GET /api/stats` — Public stats (subscriber count, alerts sent)
- `POST /api/webhook/sms` — Twilio incoming SMS webhook

### Admin (requires x-admin-password header)
- `GET /admin` — Admin dashboard
- `GET /api/admin/dashboard` — Dashboard data
- `POST /api/admin/scan` — Run scanner manually
- `POST /api/admin/send-alert` — Send alert (auto or manual)
- `GET /api/admin/subscribers` — List all subscribers
- `POST /api/admin/test-sms` — Send test SMS

---

## ⏰ How It Works

1. **Cron job** runs at 9:00 AM ET, Monday-Friday
2. **Finnhub scanner** checks 40+ tickers for biggest movers
3. **Top mover** is formatted into an SMS alert
4. **Twilio** blasts the alert to all active subscribers
5. **Everything logged** in PostgreSQL for tracking

---

## 💰 Cost Breakdown

| Service | Cost |
|---------|------|
| Render Web Service | Free |
| Render PostgreSQL | Free |
| Finnhub API | Free (60 calls/min) |
| Twilio Phone Number | ~$1.15/month |
| Twilio SMS (per msg) | ~$0.0079 |
| **100 subscribers/day** | **~$0.79/day = $16/month** |
| **500 subscribers/day** | **~$3.95/day = $79/month** |
| **1000 subscribers/day** | **~$7.90/day = $158/month** |

---

## 📈 Growth Playbook

**Phase 1 (Now):** Free SMS alerts → Build audience  
**Phase 2:** Launch TikTok marketing with alert screenshots  
**Phase 3:** Build full SM Stock Scanner app ($9.99-$14.99/mo)  
**Phase 4:** Cross-sell to Project Hope automated trading ($29/$79/$149)  

---

## ⚠️ Compliance Notes

- Always include "Reply STOP to unsubscribe" in every SMS
- Twilio handles STOP/START keywords automatically
- SMS consent is obtained at signup (landing page)
- Disclaimer: "For informational purposes only. Not financial advice."
- Keep records of all subscriber consent (stored in DB with timestamps)
