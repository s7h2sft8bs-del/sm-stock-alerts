const https = require('https');

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// Top stocks to scan - mix of popular tickers across sectors
const SCAN_TICKERS = [
    // Tech
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'CRM', 'NFLX',
    // Finance
    'JPM', 'BAC', 'GS', 'V', 'MA',
    // Healthcare
    'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK',
    // Energy
    'XOM', 'CVX', 'COP',
    // Consumer
    'WMT', 'KO', 'PEP', 'MCD', 'NKE', 'DIS', 'SBUX',
    // Trending / Volatile (penny stocks & movers)
    'PLTR', 'SOFI', 'RIVN', 'LCID', 'MARA', 'RIOT', 'COIN', 'SNAP', 'HOOD', 'SQ',
    // ETFs for context
    'SPY', 'QQQ'
];

// Fetch quote for a single ticker
function fetchQuote(ticker) {
    return new Promise((resolve, reject) => {
        const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const quote = JSON.parse(data);
                    resolve({
                        ticker,
                        currentPrice: quote.c,
                        change: quote.d,
                        percentChange: quote.dp,
                        high: quote.h,
                        low: quote.l,
                        open: quote.o,
                        previousClose: quote.pc,
                        timestamp: quote.t
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Fetch company profile
function fetchProfile(ticker) {
    return new Promise((resolve, reject) => {
        const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Scan all tickers and find the top mover
async function scanForTopMover() {
    console.log(`🔍 Scanning ${SCAN_TICKERS.length} tickers...`);

    const quotes = [];

    // Finnhub free tier: 60 calls/min, so we batch with delays
    for (let i = 0; i < SCAN_TICKERS.length; i++) {
        try {
            const quote = await fetchQuote(SCAN_TICKERS[i]);
            if (quote.currentPrice > 0 && quote.percentChange !== null) {
                quotes.push(quote);
            }
            // Rate limit: small delay between calls
            if (i % 10 === 9) {
                await new Promise(r => setTimeout(r, 1500));
            }
        } catch (err) {
            console.error(`Error fetching ${SCAN_TICKERS[i]}:`, err.message);
        }
    }

    if (quotes.length === 0) {
        console.log('❌ No quotes retrieved');
        return null;
    }

    // Sort by absolute percent change (biggest movers)
    quotes.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    // Get top mover (highest absolute % change)
    const topMover = quotes[0];

    // Get company profile for context
    let profile = {};
    try {
        profile = await fetchProfile(topMover.ticker);
    } catch (e) {
        console.log('Could not fetch profile for', topMover.ticker);
    }

    const direction = topMover.percentChange >= 0 ? '📈' : '📉';
    const reason = topMover.percentChange >= 0
        ? `Up ${topMover.percentChange.toFixed(2)}% - leading gainer in today's scan`
        : `Down ${Math.abs(topMover.percentChange).toFixed(2)}% - significant move worth watching`;

    return {
        ticker: topMover.ticker,
        companyName: profile.name || topMover.ticker,
        sector: profile.finnhubIndustry || 'N/A',
        currentPrice: topMover.currentPrice,
        percentChange: topMover.percentChange,
        change: topMover.change,
        high: topMover.high,
        low: topMover.low,
        direction,
        reason,
        topMovers: quotes.slice(0, 5)  // top 5 for admin dashboard
    };
}

// Get market overview (for admin dashboard)
async function getMarketOverview() {
    try {
        const spy = await fetchQuote('SPY');
        const qqq = await fetchQuote('QQQ');
        return {
            sp500: spy,
            nasdaq: qqq,
            marketStatus: spy.currentPrice > 0 ? 'open' : 'closed'
        };
    } catch (e) {
        return null;
    }
}

module.exports = { scanForTopMover, getMarketOverview, fetchQuote, SCAN_TICKERS };
