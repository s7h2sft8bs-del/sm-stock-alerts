const express = require('express');
const router = express.Router();
const { fetchQuote } = require('../services/finnhub');

let cachedQuotes = null;
let lastFetch = 0;

router.get('/market', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedQuotes && now - lastFetch < 60000) {
            return res.json(cachedQuotes);
        }

        const tickers = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'PLTR', 'META', 'SOFI', 'GOOGL', 'COIN', 'AMZN', 'MSFT', 'NFLX', 'DIS', 'BA', 'UBER', 'SQ', 'SNAP', 'RIVN', 'MARA', 'NIO'];
        const quotes = [];

        for (const ticker of tickers) {
            try {
                const q = await fetchQuote(ticker);
                if (q.currentPrice > 0) {
                    quotes.push({
                        symbol: q.ticker,
                        price: q.currentPrice,
                        percent: q.percentChange
                    });
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 150));
        }

        cachedQuotes = quotes;
        lastFetch = now;
        res.json(quotes);
    } catch (err) {
        res.status(500).json([]);
    }
});

module.exports = router;
