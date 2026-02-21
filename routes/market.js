const express = require('express');
const router = express.Router();
const { fetchQuote, SCAN_TICKERS } = require('../services/finnhub');

// Cache quotes for 60 seconds to avoid rate limits
let cachedQuotes = null;
let lastFetch = 0;

router.get('/market', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedQuotes && now - lastFetch < 60000) {
            return res.json(cachedQuotes);
        }

        const tickers = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'PLTR', 'META', 'SOFI', 'GOOGL', 'COIN', 'AMZN'];
        const quotes = [];

        for (const ticker of tickers) {
            try {
                const q = await fetchQuote(ticker);
                if (q.currentPrice > 0) {
                    quotes.push({
                        symbol: q.ticker,
                        percent: q.percentChange
                    });
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 200));
        }

        cachedQuotes = quotes;
        lastFetch = now;
        res.json(quotes);
    } catch (err) {
        res.status(500).json([]);
    }
});

module.exports = router;
