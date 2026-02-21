async function loadTicker() {
    try {
        const res = await fetch('/api/market');
        const data = await res.json();
        if (data.length > 0) {
            const tape = document.getElementById('tickerTape');
            let html = '';
            data.forEach(q => {
                const cls = q.percent >= 0 ? 'up' : 'down';
                const sign = q.percent >= 0 ? '+' : '';
                html += '<div class="ticker-item"><span class="symbol">' + q.symbol + '</span> <span class="' + cls + '">' + sign + q.percent.toFixed(2) + '%</span></div>';
            });
            tape.innerHTML = html + html;
        }
    } catch(e) {}
}
loadTicker();
setInterval(loadTicker, 60000);
