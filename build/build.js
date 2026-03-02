const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(__dirname, 'data');
const TEMPLATES = path.join(__dirname, 'templates');
const DOMAIN = 'https://fdbatao.com';
const YEAR = new Date().getFullYear();
const GOOGLE_VERIFICATION = '';

// ─── Tenure metadata ────────────────────────────────────────────────────────
const TENURE_TYPES = {
  '6-months': { label: '6 Months', months: 6, years: 0.5, slug: '6-months', defaultUnit: 'months', defaultTenure: 6 },
  '1-year':   { label: '1 Year',   months: 12, years: 1,  slug: '1-year',   defaultUnit: 'years',  defaultTenure: 1 },
  '2-years':  { label: '2 Years',  months: 24, years: 2,  slug: '2-years',  defaultUnit: 'years',  defaultTenure: 2 },
  '3-years':  { label: '3 Years',  months: 36, years: 3,  slug: '3-years',  defaultUnit: 'years',  defaultTenure: 3 },
  '5-years':  { label: '5 Years',  months: 60, years: 5,  slug: '5-years',  defaultUnit: 'years',  defaultTenure: 5 },
};

// ─── Amount presets ─────────────────────────────────────────────────────────
const AMOUNTS = [25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 5000000, 10000000];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatINR(num) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatINRShort(num) {
  num = Math.round(num);
  if (num >= 10000000) return '\u20B9' + (num / 10000000).toFixed(num % 10000000 === 0 ? 0 : 2) + ' Cr';
  if (num >= 100000) return '\u20B9' + (num / 100000).toFixed(num % 100000 === 0 ? 0 : 2) + ' L';
  if (num >= 1000) return '\u20B9' + (num / 1000).toFixed(0) + 'K';
  return '\u20B9' + formatINR(num);
}

function amountSlug(num) {
  if (num >= 10000000) {
    const cr = num / 10000000;
    return cr === Math.floor(cr) ? cr + '-crore' : cr.toFixed(1).replace('.', '-') + '-crore';
  }
  if (num >= 100000) {
    const l = num / 100000;
    return l === Math.floor(l) ? l + '-lakh' : l.toFixed(1).replace('.', '-') + '-lakh';
  }
  if (num >= 1000) return (num / 1000) + 'k';
  return num.toString();
}

function amountLabel(num) {
  if (num >= 10000000) {
    const cr = num / 10000000;
    return '\u20B9' + (cr === Math.floor(cr) ? cr : cr.toFixed(1)) + ' Crore';
  }
  if (num >= 100000) {
    const l = num / 100000;
    return '\u20B9' + (l === Math.floor(l) ? l : l.toFixed(1)) + ' Lakh';
  }
  if (num >= 1000) return '\u20B9' + (num / 1000) + 'K';
  return '\u20B9' + formatINR(num);
}

// FD Maturity calculation (quarterly compounding)
function calculateMaturity(principal, annualRate, years, compFreq) {
  if (principal <= 0 || years <= 0) return principal;
  if (annualRate === 0) return principal;
  const n = compFreq || 4; // quarterly by default
  const r = annualRate / 100;
  return Math.round(principal * Math.pow(1 + r / n, n * years));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Load data ───────────────────────────────────────────────────────────────
const banks = JSON.parse(fs.readFileSync(path.join(DATA, 'banks.json'), 'utf8'));
const layoutTemplate = fs.readFileSync(path.join(TEMPLATES, 'layout.html'), 'utf8');
const affiliateData = JSON.parse(fs.readFileSync(path.join(DATA, 'affiliates.json'), 'utf8'));
const affiliateTemplate = fs.readFileSync(path.join(TEMPLATES, 'affiliate.html'), 'utf8');

// ─── Calculator JS (shared across all pages) ────────────────────────────────
const CALCULATOR_JS = `
let currentUnit = 'years';
let growthData = [];

function formatCurrency(num) {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function formatCurrencyShort(num) {
    num = Math.round(num);
    if (num >= 10000000) return '\\u20B9' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '\\u20B9' + (num / 100000).toFixed(2) + ' L';
    return '\\u20B9' + formatCurrency(num);
}

function getRawNumber(id) {
    return parseInt(document.getElementById(id).value.replace(/[^0-9]/g, '')) || 0;
}

function formatAmountInput() {
    var input = document.getElementById('depositAmount');
    var raw = input.value.replace(/[^0-9]/g, '');
    if (raw) input.value = new Intl.NumberFormat('en-IN').format(parseInt(raw));
    calculate();
}

function calculateMaturity(principal, annualRate, years, compFreq) {
    if (principal <= 0 || years <= 0) return principal;
    if (annualRate === 0) return principal;
    var n = compFreq || 4;
    var r = annualRate / 100;
    return Math.round(principal * Math.pow(1 + r / n, n * years));
}

function generateGrowthSchedule(principal, annualRate, totalYears, compFreq) {
    var n = compFreq || 4;
    var schedule = [];
    for (var y = 1; y <= Math.ceil(totalYears); y++) {
        var effectiveYears = Math.min(y, totalYears);
        var maturity = calculateMaturity(principal, annualRate, effectiveYears, n);
        var interest = maturity - principal;
        schedule.push({ year: y, maturity: maturity, interest: interest, principal: principal });
    }
    return schedule;
}

function drawPieChart(principal, interest) {
    var canvas = document.getElementById('pieChart');
    if (!canvas) return;
    var container = canvas.parentElement;
    var size = container.offsetWidth;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    var cx = size / 2, cy = size / 2, outerR = size / 2 - 4, innerR = outerR * 0.62;
    var total = principal + interest;
    if (total <= 0) return;
    var principalAngle = (principal / total) * Math.PI * 2, gap = 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + gap / 2, -Math.PI / 2 + principalAngle - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + principalAngle - gap / 2, -Math.PI / 2 + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#f97316'; ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, -Math.PI / 2 + principalAngle + gap / 2, -Math.PI / 2 + Math.PI * 2 - gap / 2);
    ctx.arc(cx, cy, innerR, -Math.PI / 2 + Math.PI * 2 - gap / 2, -Math.PI / 2 + principalAngle + gap / 2, true);
    ctx.closePath(); ctx.fillStyle = '#22c55e'; ctx.fill();
}

function renderTable() {
    var head = document.getElementById('tableHead');
    var body = document.getElementById('tableBody');
    head.innerHTML = '<tr><th>Year</th><th>Deposit</th><th>Interest Earned</th><th>Maturity Value</th></tr>';
    body.innerHTML = growthData.map(function(r) {
        return '<tr><td>Year ' + r.year + '</td><td>\\u20B9' + formatCurrency(r.principal) + '</td><td>\\u20B9' + formatCurrency(r.interest) + '</td><td>\\u20B9' + formatCurrency(r.maturity) + '</td></tr>';
    }).join('');
}

function calculate() {
    var principal = getRawNumber('depositAmount');
    var rate = parseFloat(document.getElementById('interestRate').value) || 0;
    var tenureVal = parseFloat(document.getElementById('tenure').value) || 0;
    var compFreq = parseInt(document.getElementById('compounding').value) || 4;
    var years = currentUnit === 'years' ? tenureVal : tenureVal / 12;
    if (principal <= 0 || years <= 0) return;

    var maturity = calculateMaturity(principal, rate, years, compFreq);
    var interest = maturity - principal;

    document.getElementById('maturityValue').textContent = formatCurrencyShort(maturity);
    document.getElementById('interestValue').textContent = formatCurrencyShort(interest);
    document.getElementById('depositValue').textContent = formatCurrencyShort(principal);

    drawPieChart(principal, interest);
    document.getElementById('chartTotal').textContent = formatCurrencyShort(maturity);

    var principalPct = Math.round(principal / maturity * 100);
    document.getElementById('legendPrincipal').textContent = '\\u20B9' + formatCurrency(principal);
    document.getElementById('legendInterest').textContent = '\\u20B9' + formatCurrency(interest);
    document.getElementById('legendPrincipalPct').textContent = principalPct + '%';
    document.getElementById('legendInterestPct').textContent = (100 - principalPct) + '%';

    growthData = generateGrowthSchedule(principal, rate, years, compFreq);
    renderTable();
}

function downloadPDF() {
    if (growthData.length === 0) return;
    var principal = getRawNumber('depositAmount');
    var rate = parseFloat(document.getElementById('interestRate').value) || 0;
    var tenureVal = parseFloat(document.getElementById('tenure').value) || 0;
    var compFreq = parseInt(document.getElementById('compounding').value) || 4;
    var years = currentUnit === 'years' ? tenureVal : tenureVal / 12;
    var maturity = calculateMaturity(principal, rate, years, compFreq);
    var interest = maturity - principal;
    var compLabels = {1:'Annually',2:'Half-Yearly',4:'Quarterly',12:'Monthly'};
    var tenureStr = currentUnit === 'years' ? tenureVal + ' Years' : tenureVal + ' Months';

    var pw = window.open('', '_blank');
    pw.document.write('<!DOCTYPE html><html><head><title>FD Maturity Schedule - FD Batao</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:\\'Outfit\\',sans-serif;color:#1a1a1a;line-height:1.6;padding:40px 50px;max-width:900px;margin:0 auto;font-size:13px}h1{font-family:\\'Playfair Display\\',serif;font-size:22px;margin-bottom:4px}.subtitle{color:#666;font-size:13px;margin-bottom:24px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:24px}.summary-item{background:#f7f7f7;padding:12px 16px;border-radius:8px}.summary-item .s-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666}.summary-item .s-value{font-size:18px;font-weight:700;margin-top:2px}.summary-item.highlight .s-value{color:#f97316}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:right;padding:8px 10px;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666}th:first-child{text-align:left}td{padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums}td:first-child{text-align:left;color:#666}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}@media print{body{padding:20px}.summary-item{background:#f7f7f7;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>Fixed Deposit Maturity Schedule</h1><div class="subtitle">Generated on ' + new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) + ' \\u00B7 fdbatao.com</div><div class="summary"><div class="summary-item highlight"><div class="s-label">Maturity Amount</div><div class="s-value">\\u20B9' + formatCurrency(maturity) + '</div></div><div class="summary-item"><div class="s-label">Deposit Amount</div><div class="s-value">\\u20B9' + formatCurrency(principal) + '</div></div><div class="summary-item"><div class="s-label">Interest Earned</div><div class="s-value">\\u20B9' + formatCurrency(interest) + '</div></div><div class="summary-item"><div class="s-label">Effective Return</div><div class="s-value">' + (principal > 0 ? ((interest/principal)*100).toFixed(1) : 0) + '%</div></div></div><div style="font-size:13px;color:#666;margin-bottom:8px">Interest Rate: ' + rate + '% p.a. \\u00B7 Tenure: ' + tenureStr + ' \\u00B7 Compounding: ' + (compLabels[compFreq]||'Quarterly') + '</div><h2 style="font-size:16px;margin-top:24px;margin-bottom:4px">Year-wise Growth</h2><table><thead><tr><th>Year</th><th>Deposit</th><th>Interest Earned</th><th>Maturity Value</th></tr></thead><tbody>' + growthData.map(function(r){return '<tr><td>Year '+r.year+'</td><td>\\u20B9'+formatCurrency(r.principal)+'</td><td>\\u20B9'+formatCurrency(r.interest)+'</td><td>\\u20B9'+formatCurrency(r.maturity)+'</td></tr>';}).join('') + '</tbody></table><div class="footer">Generated by FD Batao (fdbatao.com) \\u00B7 Built by TUD Innovations Pvt Ltd</div><script>setTimeout(function(){window.print();window.close()},500)<\\/script></body></html>');
    pw.document.close();
}

// Init
document.getElementById('depositAmount').addEventListener('input', formatAmountInput);
document.getElementById('interestRate').addEventListener('input', calculate);
document.getElementById('tenure').addEventListener('input', calculate);
document.getElementById('compounding').addEventListener('change', calculate);

document.getElementById('tenureToggle').addEventListener('click', function(e) {
    var btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    this.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentUnit = btn.dataset.unit;
    calculate();
});

document.querySelector('.btn-calculate').addEventListener('click', function() {
    if (window.innerWidth < 900) document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
});

// Prefill and calculate
document.getElementById('depositAmount').value = new Intl.NumberFormat('en-IN').format(PREFILL_AMOUNT);
document.getElementById('interestRate').value = PREFILL_RATE;
document.getElementById('tenure').value = PREFILL_TENURE;
currentUnit = PREFILL_UNIT;
document.querySelectorAll('#tenureToggle .toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.unit === PREFILL_UNIT);
});
calculate();
`;

// ─── Page content generators ─────────────────────────────────────────────────

function calculatorHTML() {
  return `
<div class="calc-section">
    <div class="form-panel-wrapper">
        <div class="panel">
            <div class="panel-title"><div class="num">1</div> FD Details</div>
            <div class="section-label">Deposit Parameters</div>
            <div class="form-group">
                <label>Deposit Amount (\u20B9)</label>
                <div class="input-with-unit">
                    <span class="unit">\u20B9</span>
                    <input type="text" id="depositAmount" inputmode="numeric" placeholder="5,00,000">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Interest Rate (% per annum)</label>
                    <div class="input-with-unit">
                        <input type="number" id="interestRate" class="input-rate" step="0.1" min="0" max="20" placeholder="7.0">
                        <span class="unit unit-right">%</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Tenure</label>
                    <div class="tenure-row">
                        <input type="number" id="tenure" min="1" step="1" placeholder="5">
                        <div class="tenure-toggle" id="tenureToggle">
                            <button class="toggle-btn active" data-unit="years">Yr</button>
                            <button class="toggle-btn" data-unit="months">Mo</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Compounding Frequency</label>
                <select id="compounding">
                    <option value="4" selected>Quarterly (Most Common)</option>
                    <option value="12">Monthly</option>
                    <option value="2">Half-Yearly</option>
                    <option value="1">Annually</option>
                </select>
            </div>
            <button class="btn-calculate" onclick="calculate()">Calculate Maturity \u2192</button>
        </div>
    </div>
    <div>
        <div class="panel" id="resultsPanel">
            <div class="panel-title"><div class="num">2</div> Maturity Breakdown</div>
            <div class="result-cards">
                <div class="result-card highlight">
                    <div class="label">Maturity Amount</div>
                    <div class="value" id="maturityValue">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Interest Earned</div>
                    <div class="value" id="interestValue">-</div>
                </div>
                <div class="result-card">
                    <div class="label">Deposit Amount</div>
                    <div class="value" id="depositValue">-</div>
                </div>
            </div>
            <div class="chart-section">
                <div class="chart-container">
                    <canvas id="pieChart"></canvas>
                    <div class="chart-center">
                        <div class="total-label">Maturity</div>
                        <div class="total-value" id="chartTotal">-</div>
                    </div>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--accent)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Deposit Amount</div>
                            <div class="legend-value" id="legendPrincipal">-</div>
                        </div>
                        <div class="legend-percent" id="legendPrincipalPct">-</div>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background:var(--green)"></div>
                        <div class="legend-info">
                            <div class="legend-label">Interest Earned</div>
                            <div class="legend-value" id="legendInterest">-</div>
                        </div>
                        <div class="legend-percent" id="legendInterestPct">-</div>
                    </div>
                </div>
            </div>
            <div class="table-header">
                <div class="table-title">Year-wise Growth</div>
            </div>
            <div class="table-container">
                <table class="amort-table">
                    <thead id="tableHead"><tr><th>Year</th><th>Deposit</th><th>Interest Earned</th><th>Maturity Value</th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
            <button class="btn-download" onclick="downloadPDF()">\u2193 Download FD Schedule (PDF)</button>
        </div>
    </div>
</div>`;
}

function detailsGridHTML(bank, tenureKey) {
  const fd = bank.fd[tenureKey];
  return `
<div class="details-grid">
    <div class="detail-item">
        <div class="d-label">Interest Rate (General)</div>
        <div class="d-value accent">${fd.general}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Senior Citizen Rate</div>
        <div class="d-value accent">${fd.senior}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Min Deposit</div>
        <div class="d-value">\u20B9${formatINR(bank.minDeposit)}</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Compounding</div>
        <div class="d-value">${bank.compounding}</div>
    </div>
</div>`;
}

function bankDetailsGridHTML(bank) {
  const tenures = Object.keys(bank.fd);
  const bestTenure = tenures.reduce((best, t) => bank.fd[t].general > (bank.fd[best]?.general || 0) ? t : best, tenures[0]);
  return `
<div class="details-grid">
    <div class="detail-item">
        <div class="d-label">Best FD Rate</div>
        <div class="d-value accent">${bank.fd[bestTenure].general}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Senior Citizen Best</div>
        <div class="d-value accent">${bank.fd[bestTenure].senior}% p.a.</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Min Deposit</div>
        <div class="d-value">\u20B9${formatINR(bank.minDeposit)}</div>
    </div>
    <div class="detail-item">
        <div class="d-label">Premature Withdrawal</div>
        <div class="d-value">${bank.prematureWithdrawal}</div>
    </div>
</div>`;
}

function maturityComparisonTableHTML(amount, tenureKey) {
  const tt = TENURE_TYPES[tenureKey];
  const banksWithTenure = banks.filter(b => b.fd[tenureKey]).sort((a, b) => b.fd[tenureKey].general - a.fd[tenureKey].general);
  const rows = banksWithTenure.map(bank => {
    const rate = bank.fd[tenureKey].general;
    const seniorRate = bank.fd[tenureKey].senior;
    const maturity = calculateMaturity(amount, rate, tt.years, 4);
    const interest = maturity - amount;
    return `<tr><td class="amt-col"><a href="/${bank.slug}-fd-rates-${tenureKey}" style="color:var(--accent);text-decoration:none">${bank.name}</a></td><td class="emi-col">${rate}%</td><td>${seniorRate}%</td><td>\u20B9${formatINR(maturity)}</td><td>\u20B9${formatINR(interest)}</td></tr>`;
  }).join('');
  return `
<h2>${tt.label} FD Rates Comparison Across Banks</h2>
<p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Deposit: ${amountLabel(amount)} · Quarterly compounding</p>
<table class="comparison-table">
    <thead><tr><th>Bank</th><th>General Rate</th><th>Senior Rate</th><th>Maturity</th><th>Interest Earned</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

function amountComparisonTableHTML(bank, tenureKey) {
  const tt = TENURE_TYPES[tenureKey];
  const fd = bank.fd[tenureKey];
  const rows = AMOUNTS.map(amt => {
    const maturity = calculateMaturity(amt, fd.general, tt.years, 4);
    const interest = maturity - amt;
    return `<tr><td class="amt-col">${amountLabel(amt)}</td><td class="emi-col">\u20B9${formatINR(maturity)}</td><td>\u20B9${formatINR(interest)}</td><td>${((interest / amt) * 100).toFixed(1)}%</td></tr>`;
  }).join('');
  return `
<h2>Maturity for Different Deposit Amounts at ${fd.general}% p.a.</h2>
<p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Tenure: ${tt.label} · Quarterly compounding</p>
<table class="comparison-table">
    <thead><tr><th>Deposit Amount</th><th>Maturity Amount</th><th>Interest Earned</th><th>Total Return</th></tr></thead>
    <tbody>${rows}</tbody>
</table>`;
}

// ─── FAQ generators ──────────────────────────────────────────────────────────

function bankTenureFAQs(bank, tenureKey) {
  const tt = TENURE_TYPES[tenureKey];
  const fd = bank.fd[tenureKey];
  const midAmt = AMOUNTS[Math.floor(AMOUNTS.length / 2)];
  const maturity = calculateMaturity(midAmt, fd.general, tt.years, 4);
  const interest = maturity - midAmt;

  return [
    { q: `What is ${bank.name} FD interest rate for ${tt.label} in ${YEAR}?`, a: `${bank.name} offers ${tt.label} Fixed Deposit at ${fd.general}% p.a. for general citizens and ${fd.senior}% p.a. for senior citizens in ${YEAR}. Rates are subject to change.` },
    { q: `What is the maturity amount for ${amountLabel(midAmt)} FD in ${bank.name} for ${tt.label}?`, a: `A ${amountLabel(midAmt)} FD in ${bank.name} for ${tt.label} at ${fd.general}% (quarterly compounding) will mature to approximately \u20B9${formatINR(maturity)}. The interest earned would be \u20B9${formatINR(interest)}.` },
    { q: `Is ${bank.name} ${tt.label} FD good for senior citizens?`, a: `Yes, ${bank.name} offers an additional benefit for senior citizens with a rate of ${fd.senior}% p.a. for ${tt.label} FD, which is ${(fd.senior - fd.general).toFixed(2)}% higher than the general rate.` },
    { q: `What is the minimum deposit for ${bank.name} FD?`, a: `The minimum deposit amount for ${bank.name} Fixed Deposit is \u20B9${formatINR(bank.minDeposit)}. Interest is compounded ${bank.compounding.toLowerCase()}.` },
    { q: `Can I withdraw my ${bank.name} FD before maturity?`, a: `Yes, premature withdrawal is allowed. ${bank.name}'s premature withdrawal policy: ${bank.prematureWithdrawal}. It's recommended to keep the FD till maturity for maximum returns.` },
  ];
}

function tenureIndexFAQs(tenureKey) {
  const tt = TENURE_TYPES[tenureKey];
  return [
    { q: `What is a ${tt.label} Fixed Deposit?`, a: `A ${tt.label} Fixed Deposit (FD) is a savings instrument where you deposit a lump sum amount for ${tt.label} at a fixed interest rate. The interest is typically compounded quarterly, and you receive the maturity amount at the end of the tenure.` },
    { q: `Which bank offers the highest ${tt.label} FD rate in ${YEAR}?`, a: `FD rates vary across banks and are updated regularly. NBFCs like Bajaj Finserv, Shriram Finance, and Mahindra Finance typically offer higher rates. Check the comparison table on this page for current rates from all major banks.` },
    { q: `Is FD interest taxable in India?`, a: `Yes, FD interest is taxable as per your income tax slab. TDS at 10% is deducted if interest exceeds \u20B940,000 per year (\u20B950,000 for senior citizens). You can submit Form 15G/15H to avoid TDS if your total income is below the taxable limit.` },
    { q: `What is the difference between cumulative and non-cumulative FD?`, a: `In a cumulative FD, interest is compounded and paid at maturity, giving higher effective returns. In a non-cumulative FD, interest is paid out periodically (monthly/quarterly), resulting in slightly lower overall returns but regular income.` },
    { q: `Can I get a loan against my ${tt.label} FD?`, a: `Yes, most banks offer loans against FD at interest rates 1-2% above the FD rate. You can typically borrow up to 90% of the FD value without breaking the deposit, which continues to earn interest.` },
  ];
}

function bankIndexFAQs(bank) {
  const tenures = Object.keys(bank.fd);
  const bestTenure = tenures.reduce((best, t) => bank.fd[t].general > (bank.fd[best]?.general || 0) ? t : best, tenures[0]);
  return [
    { q: `What are ${bank.name} FD interest rates in ${YEAR}?`, a: `${bank.name} offers FD rates ranging from ${Math.min(...tenures.map(t => bank.fd[t].general))}% to ${Math.max(...tenures.map(t => bank.fd[t].general))}% p.a. for general citizens. Senior citizens get an additional ${(bank.fd[bestTenure].senior - bank.fd[bestTenure].general).toFixed(2)}% benefit.` },
    { q: `What is the best ${bank.name} FD rate?`, a: `The best ${bank.name} FD rate for general citizens is ${bank.fd[bestTenure].general}% p.a. for ${TENURE_TYPES[bestTenure].label} tenure, and ${bank.fd[bestTenure].senior}% for senior citizens.` },
    { q: `What is the minimum deposit for ${bank.name} FD?`, a: `The minimum deposit amount for ${bank.name} Fixed Deposit is \u20B9${formatINR(bank.minDeposit)}. Interest is compounded ${bank.compounding.toLowerCase()}.` },
    { q: `Does ${bank.name} offer special FD schemes?`, a: `${bank.specialScheme !== 'None' ? bank.name + ' offers: ' + bank.specialScheme + '.' : bank.name + ' currently does not have any special FD scheme.'} Check with the bank for the latest offers.` },
    { q: `Is ${bank.name} FD safe?`, a: `${bank.type === 'bank' ? 'Yes, ' + bank.name + ' FDs are insured by DICGC (Deposit Insurance and Credit Guarantee Corporation) up to \\u20B95 Lakh per depositor per bank.' : bank.name + ' is an NBFC regulated by RBI. While NBFC FDs are not covered by DICGC insurance, ' + bank.name + ' has a strong credit rating and track record.'}` },
  ];
}

function amountFAQs(amount) {
  return [
    { q: `How much interest will I earn on ${amountLabel(amount)} FD?`, a: `The interest earned on ${amountLabel(amount)} FD depends on the bank, interest rate, tenure, and compounding frequency. At 7% for 1 year (quarterly compounding), you would earn approximately \u20B9${formatINR(calculateMaturity(amount, 7, 1, 4) - amount)} as interest.` },
    { q: `Which bank gives the best return on ${amountLabel(amount)} FD?`, a: `For the highest returns on ${amountLabel(amount)}, NBFCs like Bajaj Finserv, Shriram Finance, and Mahindra Finance typically offer higher rates (7.5-8%). Among banks, private banks like IndusInd and Yes Bank offer competitive rates.` },
    { q: `Is TDS applicable on ${amountLabel(amount)} FD?`, a: `TDS at 10% is deducted if FD interest exceeds \u20B940,000 per year (\u20B950,000 for senior citizens). For ${amountLabel(amount)} at ~7%, annual interest would be ~\u20B9${formatINR(Math.round(amount * 0.07))}, so ${amount * 0.07 > 40000 ? 'TDS would be applicable' : 'TDS may not be applicable if this is your only FD'}.` },
    { q: `Should I invest ${amountLabel(amount)} in one FD or split across banks?`, a: `DICGC covers up to \u20B95 Lakh per bank. ${amount > 500000 ? 'Since your deposit exceeds \\u20B95 Lakh, consider splitting across banks for full insurance coverage.' : 'Your deposit is within the \\u20B95 Lakh DICGC limit, so a single bank FD is fine.'} Also compare rates across banks to maximize returns.` },
    { q: `What is the maturity of ${amountLabel(amount)} FD in 5 years?`, a: `At 7% with quarterly compounding, ${amountLabel(amount)} FD would mature to approximately \u20B9${formatINR(calculateMaturity(amount, 7, 5, 4))} in 5 years, earning \u20B9${formatINR(calculateMaturity(amount, 7, 5, 4) - amount)} as interest.` },
  ];
}

function faqHTML(faqs) {
  const items = faqs.map(f => `
    <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
    </div>`).join('');

  return `
<section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    ${items}
</section>`;
}

function faqSchemaJSON(faqs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  });
}

function breadcrumbSchemaJSON(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.label,
      ...(item.href ? { "item": DOMAIN + item.href } : {})
    }))
  });
}

// ─── Page assembly ───────────────────────────────────────────────────────────

function buildPage(opts) {
  const { title, description, keywords, canonicalPath, breadcrumb, breadcrumbItems, content, faqSection, linksSection, prefillAmount, prefillRate, prefillTenure, prefillUnit, jsonLd } = opts;

  let allJsonLd = '';
  if (jsonLd) allJsonLd += `<script type="application/ld+json">\n${jsonLd}\n</script>\n`;
  if (breadcrumbItems) allJsonLd += `    <script type="application/ld+json">\n${breadcrumbSchemaJSON(breadcrumbItems)}\n</script>`;

  const verificationTag = GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">` : '';

  let html = layoutTemplate
    .replace(/{{PAGE_TITLE}}/g, title)
    .replace(/{{META_DESCRIPTION}}/g, description)
    .replace(/{{META_KEYWORDS}}/g, keywords || '')
    .replace(/{{CANONICAL_PATH}}/g, canonicalPath)
    .replace('{{JSON_LD}}', allJsonLd)
    .replace('{{GOOGLE_VERIFICATION}}', verificationTag)
    .replace('{{BREADCRUMB}}', breadcrumb || '')
    .replace('{{CONTENT}}', content)
    .replace('{{FAQ_SECTION}}', faqSection || '')
    .replace('{{LINKS_SECTION}}', linksSection || '')
    .replace('{{CALCULATOR_JS}}', `var PREFILL_AMOUNT = ${prefillAmount};\nvar PREFILL_RATE = ${prefillRate};\nvar PREFILL_TENURE = ${prefillTenure};\nvar PREFILL_UNIT = '${prefillUnit || 'years'}';\n` + CALCULATOR_JS);

  return html;
}

function breadcrumbHTML(items) {
  const links = items.map((item, i) => {
    if (i === items.length - 1) return `<span style="color:var(--text)">${item.label}</span>`;
    return `<a href="${item.href}">${item.label}</a>`;
  });
  return `<nav class="breadcrumb">${links.join('<span>\u203A</span>')}</nav>`;
}

function linksGridHTML(title, links) {
  if (!links.length) return '';
  const items = links.map(l => `<a href="${l.href}">${l.label}${l.sub ? '<span class="link-sub">' + l.sub + '</span>' : ''}</a>`).join('');
  return `
<section class="links-section">
    <h2>${title}</h2>
    <div class="links-grid">${items}</div>
</section>`;
}

// ─── Page generators ─────────────────────────────────────────────────────────
const allPages = [];

// 1. Tenure Index Pages (e.g., /1-year-fd-rates)
function generateTenureIndexPage(tenureKey) {
  const tt = TENURE_TYPES[tenureKey];
  const slug = `${tenureKey}-fd-rates`;
  const banksWithTenure = banks.filter(b => b.fd[tenureKey]).sort((a, b) => b.fd[tenureKey].general - a.fd[tenureKey].general);
  const bestBank = banksWithTenure[0];
  const defaultAmt = AMOUNTS[Math.floor(AMOUNTS.length / 2)];

  const faqs = tenureIndexFAQs(tenureKey);

  const bankLinks = banksWithTenure.map(b => ({
    href: `/${b.slug}-fd-rates-${tenureKey}`,
    label: `${b.name} ${tt.label} FD Rate`,
    sub: `${b.fd[tenureKey].general}% p.a.`,
  }));

  const amountLinks = AMOUNTS.map(a => ({
    href: `/${tenureKey}-fd-calculator-for-${amountSlug(a)}`,
    label: `${tt.label} FD for ${amountLabel(a)}`,
  }));

  const otherTenureLinks = Object.keys(TENURE_TYPES)
    .filter(t => t !== tenureKey)
    .map(t => ({
      href: `/${t}-fd-rates`,
      label: `${TENURE_TYPES[t].label} FD Rates`,
    }));

  const content = `
<section class="page-hero">
    <h1><span class="hl">${tt.label}</span> FD Interest Rates ${YEAR}</h1>
    <p>Compare ${tt.label} Fixed Deposit rates from ${banksWithTenure.length}+ banks & NBFCs. Best rate: ${bestBank ? bestBank.fd[tenureKey].general : 'N/A'}% by ${bestBank ? bestBank.name : 'N/A'}.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${tt.label} FD Rates — All Banks Comparison ${YEAR}</h2>
    <p>Compare ${tt.label} Fixed Deposit interest rates and maturity amounts across all major Indian banks and NBFCs.</p>
    ${maturityComparisonTableHTML(defaultAmt, tenureKey)}
</section>`;

  const links =
    linksGridHTML(`${tt.label} FD by Bank`, bankLinks) +
    linksGridHTML(`${tt.label} FD by Amount`, amountLinks) +
    linksGridHTML('Other FD Tenures', otherTenureLinks);

  const html = buildPage({
    title: `${tt.label} FD Interest Rates ${YEAR} | Compare All Banks | FD Batao`,
    description: `Compare ${tt.label} FD interest rates from ${banksWithTenure.length}+ banks. Best rate: ${bestBank ? bestBank.fd[tenureKey].general : '7'}% p.a. Calculate maturity amount with FD calculator.`,
    keywords: `${tenureKey} fd rates, ${tt.label.toLowerCase()} fixed deposit rates ${YEAR}, best ${tt.label.toLowerCase()} fd rate`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: `${tt.label} FD Rates` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: bestBank ? bestBank.fd[tenureKey].general : 7,
    prefillTenure: tt.defaultTenure,
    prefillUnit: tt.defaultUnit,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 2. Bank Index Pages (e.g., /sbi-fd-calculator)
function generateBankIndexPage(bank) {
  const slug = `${bank.slug}-fd-calculator`;
  const tenures = Object.keys(bank.fd);
  const faqs = bankIndexFAQs(bank);

  const tenureLinks = tenures.map(t => ({
    href: `/${bank.slug}-fd-rates-${t}`,
    label: `${bank.name} ${TENURE_TYPES[t].label} FD Rate`,
    sub: `${bank.fd[t].general}% p.a.`,
  }));

  const otherBankLinks = banks
    .filter(b => b.slug !== bank.slug)
    .slice(0, 12)
    .map(b => ({
      href: `/${b.slug}-fd-calculator`,
      label: `${b.name} FD Calculator`,
    }));

  const rateRows = tenures.map(t => {
    const fd = bank.fd[t];
    const maturity = calculateMaturity(100000, fd.general, TENURE_TYPES[t].years, 4);
    return `<tr><td class="amt-col"><a href="/${bank.slug}-fd-rates-${t}" style="color:var(--accent);text-decoration:none">${TENURE_TYPES[t].label}</a></td><td class="emi-col">${fd.general}%</td><td>${fd.senior}%</td><td>\u20B9${formatINR(maturity)}</td></tr>`;
  }).join('');

  const bestTenure = tenures.reduce((best, t) => bank.fd[t].general > (bank.fd[best]?.general || 0) ? t : best, tenures[0]);
  const defaultAmt = AMOUNTS[Math.floor(AMOUNTS.length / 2)];

  const content = `
<section class="page-hero">
    <h1><span class="hl">${bank.name}</span> FD Calculator ${YEAR}</h1>
    <p>Calculate ${bank.fullName} Fixed Deposit maturity amount. FD rates from ${Math.min(...tenures.map(t => bank.fd[t].general))}% to ${Math.max(...tenures.map(t => bank.fd[t].general))}% p.a.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${bank.name} FD Interest Rates ${YEAR}</h2>
    ${bankDetailsGridHTML(bank)}
    <p>${bank.fullName} offers Fixed Deposits across multiple tenures. ${bank.specialScheme !== 'None' ? 'Special scheme: ' + bank.specialScheme + '.' : ''} Interest is compounded ${bank.compounding.toLowerCase()}.</p>
    <table class="comparison-table">
        <thead><tr><th>Tenure</th><th>General Rate</th><th>Senior Rate</th><th>Maturity (\u20B91L)</th></tr></thead>
        <tbody>${rateRows}</tbody>
    </table>
</section>`;

  const links =
    linksGridHTML(`${bank.name} FD by Tenure`, tenureLinks) +
    linksGridHTML('Other Bank FD Calculators', otherBankLinks);

  const html = buildPage({
    title: `${bank.name} FD Calculator ${YEAR} | FD Interest Rates | FD Batao`,
    description: `Calculate ${bank.name} FD maturity amount. Interest rates: ${Math.min(...tenures.map(t => bank.fd[t].general))}% - ${Math.max(...tenures.map(t => bank.fd[t].general))}% p.a. Compare tenures and get instant results.`,
    keywords: `${bank.slug} fd calculator, ${bank.name} fd interest rate, ${bank.name} fixed deposit rate ${YEAR}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: `${bank.name} FD Calculator` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: bank.fd[bestTenure].general,
    prefillTenure: TENURE_TYPES[bestTenure].defaultTenure,
    prefillUnit: TENURE_TYPES[bestTenure].defaultUnit,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 3. Bank + Tenure Pages (e.g., /sbi-fd-rates-1-year)
function generateBankTenurePage(bank, tenureKey) {
  const fd = bank.fd[tenureKey];
  if (!fd) return;
  const tt = TENURE_TYPES[tenureKey];
  const slug = `${bank.slug}-fd-rates-${tenureKey}`;
  const defaultAmt = AMOUNTS[Math.floor(AMOUNTS.length / 2)];
  const maturity = calculateMaturity(defaultAmt, fd.general, tt.years, 4);
  const interest = maturity - defaultAmt;

  const faqs = bankTenureFAQs(bank, tenureKey);

  const amountLinks = AMOUNTS.map(a => ({
    href: `/${bank.slug}-${tenureKey}-fd-for-${amountSlug(a)}`,
    label: `${bank.name} ${tt.label} FD for ${amountLabel(a)}`,
  }));

  const otherBankLinks = banks
    .filter(b => b.slug !== bank.slug && b.fd[tenureKey])
    .slice(0, 12)
    .map(b => ({
      href: `/${b.slug}-fd-rates-${tenureKey}`,
      label: `${b.name} ${tt.label} FD Rate`,
      sub: `${b.fd[tenureKey].general}% p.a.`,
    }));

  const otherTenureLinks = Object.keys(bank.fd)
    .filter(t => t !== tenureKey)
    .map(t => ({
      href: `/${bank.slug}-fd-rates-${t}`,
      label: `${bank.name} ${TENURE_TYPES[t].label} FD`,
    }));

  const content = `
<section class="page-hero">
    <h1>${bank.name} <span class="hl">${tt.label}</span> FD Rate ${YEAR}</h1>
    <p>${bank.name} ${tt.label} FD rate: ${fd.general}% (general) & ${fd.senior}% (senior citizen). Maturity for ${amountLabel(defaultAmt)}: \u20B9${formatINR(maturity)}.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${bank.name} ${tt.label} FD Details ${YEAR}</h2>
    ${detailsGridHTML(bank, tenureKey)}
    <p>${bank.fullName} offers ${tt.label} Fixed Deposit at ${fd.general}% p.a. for general citizens and ${fd.senior}% p.a. for senior citizens. Interest is compounded ${bank.compounding.toLowerCase()}. Premature withdrawal policy: ${bank.prematureWithdrawal}.</p>
    ${amountComparisonTableHTML(bank, tenureKey)}
</section>`;

  const links =
    linksGridHTML(`${bank.name} ${tt.label} FD by Amount`, amountLinks) +
    linksGridHTML(`${tt.label} FD from Other Banks`, otherBankLinks) +
    linksGridHTML(`Other ${bank.name} FD Tenures`, otherTenureLinks);

  const html = buildPage({
    title: `${bank.name} ${tt.label} FD Rate ${YEAR} | FD Batao`,
    description: `${bank.name} ${tt.label} FD rate: ${fd.general}% p.a. Maturity for ${amountLabel(defaultAmt)} = \u20B9${formatINR(maturity)}. Senior citizen rate: ${fd.senior}%. Calculate FD returns instantly.`,
    keywords: `${bank.slug} ${tenureKey} fd rate, ${bank.name} ${tt.label.toLowerCase()} fixed deposit rate, ${bank.name} fd rate ${YEAR}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${tenureKey}-fd-rates`, label: `${tt.label} FD Rates` },
      { href: `/${bank.slug}-fd-calculator`, label: bank.name },
      { label: `${bank.name} ${tt.label} FD` },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: defaultAmt,
    prefillRate: fd.general,
    prefillTenure: tt.defaultTenure,
    prefillUnit: tt.defaultUnit,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 4. Tenure + Amount Pages (e.g., /1-year-fd-calculator-for-5-lakh)
function generateTenureAmountPage(tenureKey, amount) {
  const tt = TENURE_TYPES[tenureKey];
  const slug = `${tenureKey}-fd-calculator-for-${amountSlug(amount)}`;

  const banksWithTenure = banks.filter(b => b.fd[tenureKey]);
  const avgRate = banksWithTenure.reduce((sum, b) => sum + b.fd[tenureKey].general, 0) / banksWithTenure.length;
  const displayRate = Math.round(avgRate * 100) / 100;
  const maturity = calculateMaturity(amount, displayRate, tt.years, 4);

  const faqs = amountFAQs(amount);

  const bankLinks = banksWithTenure
    .sort((a, b) => b.fd[tenureKey].general - a.fd[tenureKey].general)
    .slice(0, 15)
    .map(b => ({
      href: `/${b.slug}-${tenureKey}-fd-for-${amountSlug(amount)}`,
      label: `${b.name} ${tt.label} FD for ${amountLabel(amount)}`,
      sub: `${b.fd[tenureKey].general}% p.a.`,
    }));

  const otherAmountLinks = AMOUNTS
    .filter(a => a !== amount)
    .map(a => ({
      href: `/${tenureKey}-fd-calculator-for-${amountSlug(a)}`,
      label: `${tt.label} FD for ${amountLabel(a)}`,
    }));

  const content = `
<section class="page-hero">
    <h1>${amountLabel(amount)} <span class="hl">${tt.label} FD</span> Calculator</h1>
    <p>Calculate maturity for ${amountLabel(amount)} Fixed Deposit for ${tt.label}. Compare rates across ${banksWithTenure.length}+ banks and NBFCs.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${amountLabel(amount)} ${tt.label} FD — Bank Comparison</h2>
    <p>Investing ${amountLabel(amount)} in a ${tt.label} FD? At an average rate of ${displayRate}%, your deposit would mature to approximately \u20B9${formatINR(maturity)} with \u20B9${formatINR(maturity - amount)} as interest earned.</p>
    ${maturityComparisonTableHTML(amount, tenureKey)}
</section>`;

  const links =
    linksGridHTML(`${amountLabel(amount)} ${tt.label} FD from Banks`, bankLinks) +
    linksGridHTML(`Other ${tt.label} FD Amounts`, otherAmountLinks);

  const html = buildPage({
    title: `${amountLabel(amount)} ${tt.label} FD Calculator | FD Batao`,
    description: `Calculate ${amountLabel(amount)} ${tt.label} FD maturity. At ${displayRate}%, maturity = \u20B9${formatINR(maturity)}. Compare rates from ${banksWithTenure.length}+ banks.`,
    keywords: `${amountSlug(amount)} ${tenureKey} fd, ${amountLabel(amount)} fixed deposit ${tt.label.toLowerCase()}, fd calculator for ${amountSlug(amount)}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${tenureKey}-fd-rates`, label: `${tt.label} FD Rates` },
      { label: amountLabel(amount) },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: amount,
    prefillRate: displayRate,
    prefillTenure: tt.defaultTenure,
    prefillUnit: tt.defaultUnit,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// 5. Bank + Tenure + Amount Pages (e.g., /sbi-1-year-fd-for-5-lakh)
function generateBankTenureAmountPage(bank, tenureKey, amount) {
  const fd = bank.fd[tenureKey];
  if (!fd) return;
  const tt = TENURE_TYPES[tenureKey];
  const slug = `${bank.slug}-${tenureKey}-fd-for-${amountSlug(amount)}`;
  const maturity = calculateMaturity(amount, fd.general, tt.years, 4);
  const interest = maturity - amount;
  const seniorMaturity = calculateMaturity(amount, fd.senior, tt.years, 4);
  const seniorInterest = seniorMaturity - amount;

  const faqs = [
    { q: `What is the maturity amount for ${amountLabel(amount)} FD in ${bank.name} for ${tt.label}?`, a: `At ${fd.general}% p.a. (quarterly compounding), ${amountLabel(amount)} FD in ${bank.name} for ${tt.label} matures to \u20B9${formatINR(maturity)}. Interest earned: \u20B9${formatINR(interest)}. Senior citizen maturity: \u20B9${formatINR(seniorMaturity)} at ${fd.senior}%.` },
    { q: `What is ${bank.name} ${tt.label} FD rate for ${amountLabel(amount)}?`, a: `${bank.name} offers ${fd.general}% p.a. for general citizens and ${fd.senior}% p.a. for senior citizens on ${tt.label} Fixed Deposit. The rate applies regardless of the deposit amount.` },
    { q: `How much interest will I earn on ${amountLabel(amount)} FD at ${bank.name}?`, a: `For ${amountLabel(amount)} at ${fd.general}% for ${tt.label}, you would earn approximately \u20B9${formatINR(interest)} as interest, making total maturity \u20B9${formatINR(maturity)}. Senior citizens earn \u20B9${formatINR(seniorInterest)} at ${fd.senior}%.` },
    { q: `Can I break my ${bank.name} FD of ${amountLabel(amount)} early?`, a: `Yes, premature withdrawal is allowed. ${bank.name}'s policy: ${bank.prematureWithdrawal}. You will receive a reduced interest rate on early withdrawal.` },
    { q: `Is ${amountLabel(amount)} FD at ${bank.name} better than other banks?`, a: `Compare with other banks on this page to find the best rates. ${bank.type === 'bank' ? 'Bank FDs offer DICGC insurance up to \\u20B95 Lakh.' : 'NBFC FDs typically offer higher rates but without DICGC insurance.'} Consider both rate and safety.` },
  ];

  const otherBankLinks = banks
    .filter(b => b.slug !== bank.slug && b.fd[tenureKey])
    .slice(0, 10)
    .map(b => ({
      href: `/${b.slug}-${tenureKey}-fd-for-${amountSlug(amount)}`,
      label: `${b.name} ${tt.label} FD for ${amountLabel(amount)}`,
      sub: `${b.fd[tenureKey].general}% p.a.`,
    }));

  const otherAmountLinks = AMOUNTS
    .filter(a => a !== amount)
    .slice(0, 8)
    .map(a => ({
      href: `/${bank.slug}-${tenureKey}-fd-for-${amountSlug(a)}`,
      label: `${bank.name} ${tt.label} FD for ${amountLabel(a)}`,
    }));

  const content = `
<section class="page-hero">
    <h1>${bank.name} <span class="hl">${tt.label} FD</span> for ${amountLabel(amount)}</h1>
    <p>Maturity: \u20B9${formatINR(maturity)} at ${fd.general}% p.a. Interest earned: \u20B9${formatINR(interest)}. Senior citizen maturity: \u20B9${formatINR(seniorMaturity)}.</p>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

${calculatorHTML()}

<section class="info-section">
    <h2>${bank.name} ${tt.label} FD for ${amountLabel(amount)} — Key Details</h2>
    ${detailsGridHTML(bank, tenureKey)}
    <p>A ${amountLabel(amount)} Fixed Deposit in ${bank.name} for ${tt.label} at ${fd.general}% p.a. (quarterly compounding) will mature to \u20B9${formatINR(maturity)}. You earn \u20B9${formatINR(interest)} as interest, giving a total return of ${((interest / amount) * 100).toFixed(1)}% on your investment.</p>
</section>`;

  const links =
    linksGridHTML(`${amountLabel(amount)} ${tt.label} FD from Other Banks`, otherBankLinks) +
    linksGridHTML(`Other ${bank.name} ${tt.label} FD Amounts`, otherAmountLinks);

  const html = buildPage({
    title: `${bank.name} ${tt.label} FD for ${amountLabel(amount)} (${YEAR}) | FD Batao`,
    description: `${bank.name} ${tt.label} FD for ${amountLabel(amount)}: maturity \u20B9${formatINR(maturity)} at ${fd.general}%. Interest earned: \u20B9${formatINR(interest)}. Senior rate: ${fd.senior}%.`,
    keywords: `${bank.slug} ${tenureKey} fd for ${amountSlug(amount)}, ${bank.name} fd maturity ${amountLabel(amount)} ${tt.label.toLowerCase()}`,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { href: `/${tenureKey}-fd-rates`, label: `${tt.label} FD Rates` },
      { href: `/${bank.slug}-fd-rates-${tenureKey}`, label: bank.name },
      { label: amountLabel(amount) },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection: faqHTML(faqs),
    linksSection: links,
    prefillAmount: amount,
    prefillRate: fd.general,
    prefillTenure: tt.defaultTenure,
    prefillUnit: tt.defaultUnit,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// ─── Affiliate page generator ────────────────────────────────────────────────

function buildAffiliatePage(opts) {
  const { title, description, keywords, canonicalPath, breadcrumb, breadcrumbItems, content, faqSection, linksSection, disclaimer, jsonLd } = opts;

  let allJsonLd = '';
  if (jsonLd) allJsonLd += `<script type="application/ld+json">\n${jsonLd}\n</script>\n`;
  if (breadcrumbItems) allJsonLd += `    <script type="application/ld+json">\n${breadcrumbSchemaJSON(breadcrumbItems)}\n</script>`;

  const verificationTag = GOOGLE_VERIFICATION ? `<meta name="google-site-verification" content="${GOOGLE_VERIFICATION}">` : '';

  let html = affiliateTemplate
    .replace(/{{PAGE_TITLE}}/g, title)
    .replace(/{{META_DESCRIPTION}}/g, description)
    .replace(/{{META_KEYWORDS}}/g, keywords || '')
    .replace(/{{CANONICAL_PATH}}/g, canonicalPath)
    .replace('{{JSON_LD}}', allJsonLd)
    .replace('{{GOOGLE_VERIFICATION}}', verificationTag)
    .replace('{{BREADCRUMB}}', breadcrumb || '')
    .replace('{{CONTENT}}', content)
    .replace('{{FAQ_SECTION}}', faqSection || '')
    .replace('{{LINKS_SECTION}}', linksSection || '')
    .replace('{{DISCLAIMER}}', disclaimer || '');

  return html;
}

function generateAffiliatePage(pageData) {
  const { slug, title, description, keywords, heroTitle, heroSub, pageType, sortBy, topPicks, editorNotes, badges, ctaText, faqs, comparisonFactors } = pageData;

  let content = '';

  if (pageType === 'rate-comparison') {
    // --- Best FD Rates page ---
    const sortTenure = sortBy || '1-year';
    const banksWithTenure = banks
      .filter(b => b.fd[sortTenure])
      .sort((a, b) => b.fd[sortTenure].general - a.fd[sortTenure].general);

    // Top 3 Picks
    const topBanks = topPicks
      .map(slug => banks.find(b => b.slug === slug))
      .filter(b => b);

    const picksHTML = topBanks.map((bank, i) => {
      const bestTenure = Object.keys(bank.fd).reduce((best, t) => bank.fd[t].general > (bank.fd[best]?.general || 0) ? t : best, Object.keys(bank.fd)[0]);
      const bestRate = bank.fd[bestTenure].general;
      const seniorRate = bank.fd[bestTenure].senior;
      const badgeText = badges[bank.slug] || '';
      const note = editorNotes[bank.slug] || '';

      return `
    <div class="pick-card${i === 0 ? ' featured' : ''}">
        ${badgeText ? `<div class="pick-badge">${badgeText}</div>` : ''}
        <div class="pick-rank">#${i + 1} Pick</div>
        <div class="pick-name">${bank.fullName}</div>
        <div class="pick-rate">${bestRate}% <small>p.a.</small></div>
        <p class="pick-note">${note}</p>
        <ul class="pick-features">
            <li>Senior citizen rate: ${seniorRate}%</li>
            <li>Min deposit: \u20B9${formatINR(bank.minDeposit)}</li>
            <li>Compounding: ${bank.compounding}</li>
            <li>${bank.type === 'bank' ? 'DICGC insured up to \u20B95 Lakh' : 'RBI regulated NBFC'}</li>
        </ul>
        <a href="/${bank.slug}-fd-calculator" class="pick-cta">${ctaText} \u2192</a>
    </div>`;
    }).join('');

    // Full comparison table
    const allBanksSorted = [...banks].sort((a, b) => {
      const aRate = a.fd[sortTenure]?.general || 0;
      const bRate = b.fd[sortTenure]?.general || 0;
      return bRate - aRate;
    });

    const tableRows = allBanksSorted.map(bank => {
      const r1y = bank.fd['1-year']?.general || '-';
      const r3y = bank.fd['3-years']?.general || '-';
      const r5y = bank.fd['5-years']?.general || '-';
      const bestTenure = Object.keys(bank.fd).reduce((best, t) => bank.fd[t].general > (bank.fd[best]?.general || 0) ? t : best, Object.keys(bank.fd)[0]);
      const seniorBonus = (bank.fd[bestTenure].senior - bank.fd[bestTenure].general).toFixed(2);
      return `<tr>
        <td class="bank-name"><a href="/${bank.slug}-fd-calculator" style="color:var(--text);text-decoration:none">${bank.name}</a></td>
        <td class="rate-col">${r1y}%</td>
        <td>${r3y}%</td>
        <td>${r5y}%</td>
        <td>+${seniorBonus}%</td>
        <td>\u20B9${formatINR(bank.minDeposit)}</td>
        <td class="cta-col"><a href="/${bank.slug}-fd-calculator" class="table-cta">${ctaText} \u2192</a></td>
    </tr>`;
    }).join('');

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span> in India ${YEAR}</h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="top-picks">
    <h2 class="top-picks-title">Our Top Picks</h2>
    <div class="picks-grid">
        ${picksHTML}
    </div>
</section>

<section class="comparison-section">
    <h2>All FD Rates \u2014 Full Comparison ${YEAR}</h2>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">Sorted by 1-year FD rate (highest first). Rates shown are for general citizens.</p>
    <div class="table-container">
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Bank</th>
                    <th>1Y Rate</th>
                    <th>3Y Rate</th>
                    <th>5Y Rate</th>
                    <th>Senior +</th>
                    <th>Min Deposit</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>Calculate Your FD Maturity</h3>
        <p>Know your exact maturity amount, interest earned, and year-wise growth schedule.</p>
        <a href="/" class="calc-cta-btn">Open FD Calculator \u2192</a>
    </div>
</section>`;

  } else if (pageType === 'tax-saving') {
    // --- Tax Saving FD page ---
    const taxBanks = banks
      .filter(b => b.fd['5-years'] && b.type === 'bank' || b.type === 'govt')
      .sort((a, b) => b.fd['5-years'].general - a.fd['5-years'].general);

    // Top 3 Picks
    const topBanks = topPicks
      .map(slug => banks.find(b => b.slug === slug))
      .filter(b => b && b.fd['5-years']);

    const picksHTML = topBanks.map((bank, i) => {
      const fd5y = bank.fd['5-years'];
      const badgeText = badges[bank.slug] || '';
      const note = editorNotes[bank.slug] || '';

      return `
    <div class="pick-card${i === 0 ? ' featured' : ''}">
        ${badgeText ? `<div class="pick-badge">${badgeText}</div>` : ''}
        <div class="pick-rank">#${i + 1} Pick</div>
        <div class="pick-name">${bank.fullName}</div>
        <div class="pick-rate">${fd5y.general}% <small>p.a.</small></div>
        <p class="pick-note">${note}</p>
        <ul class="pick-features">
            <li>Senior citizen rate: ${fd5y.senior}%</li>
            <li>Min deposit: \u20B9${formatINR(bank.minDeposit)}</li>
            <li>Lock-in: 5 years (mandatory)</li>
            <li>Section 80C deduction up to \u20B91.5 Lakh</li>
        </ul>
        <a href="/${bank.slug}-fd-rates-5-years" class="pick-cta">${ctaText} \u2192</a>
    </div>`;
    }).join('');

    // Tax saving comparison table
    const tableRows = taxBanks.map(bank => {
      const fd5y = bank.fd['5-years'];
      const maturity = calculateMaturity(150000, fd5y.general, 5, 4);
      return `<tr>
        <td class="bank-name"><a href="/${bank.slug}-fd-rates-5-years" style="color:var(--text);text-decoration:none">${bank.name}</a></td>
        <td class="rate-col">${fd5y.general}%</td>
        <td>${fd5y.senior}%</td>
        <td>\u20B9${formatINR(bank.minDeposit)}</td>
        <td>\u20B9${formatINR(maturity)}</td>
        <td style="color:var(--green)">Yes</td>
        <td class="cta-col"><a href="/${bank.slug}-fd-rates-5-years" class="table-cta">${ctaText} \u2192</a></td>
    </tr>`;
    }).join('');

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span> ${YEAR} \u2014 Section 80C</h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="top-picks">
    <h2 class="top-picks-title">Our Top Picks for Tax Saving FD</h2>
    <div class="picks-grid">
        ${picksHTML}
    </div>
</section>

<section class="comparison-section">
    <h2>Tax Saving FD Rates \u2014 All Banks ${YEAR}</h2>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">5-year lock-in FDs eligible under Section 80C. Maturity calculated for \u20B91.5 Lakh deposit (max 80C limit). Sorted by rate.</p>
    <div class="table-container">
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Bank</th>
                    <th>5Y General Rate</th>
                    <th>5Y Senior Rate</th>
                    <th>Min Deposit</th>
                    <th>Maturity (\u20B91.5L)</th>
                    <th>80C Eligible</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</section>

<section class="info-section">
    <h2>How Tax Saving FD Works Under Section 80C</h2>
    <p>A tax saving Fixed Deposit is a special FD with a mandatory 5-year lock-in period. The principal amount (up to \u20B91.5 Lakh per financial year) qualifies for tax deduction under Section 80C of the Income Tax Act.</p>
    <ul>
        <li><strong>Lock-in Period:</strong> 5 years (no premature withdrawal)</li>
        <li><strong>Max Deduction:</strong> \u20B91.5 Lakh under Section 80C</li>
        <li><strong>Interest Taxability:</strong> Interest earned is fully taxable as per your slab</li>
        <li><strong>Nomination:</strong> Available (but not joint holding with \u201Cor\u201D option)</li>
        <li><strong>Eligibility:</strong> Only banks and Post Office FDs qualify (not NBFC FDs)</li>
    </ul>
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>Calculate Your Tax Saving FD Maturity</h3>
        <p>See exact maturity for \u20B91.5 Lakh invested for 5 years at your chosen bank's rate.</p>
        <a href="/" class="calc-cta-btn">Open FD Calculator \u2192</a>
    </div>
</section>`;

  } else if (pageData.contentType === 'guide') {
    // --- Guide / Blog content page ---
    const guideContentHTML = (pageData.guideContent || []).map(block => {
      if (block.type === 'h2') return `<h2>${block.text}</h2>`;
      if (block.type === 'h3') return `<h3>${block.text}</h3>`;
      if (block.type === 'p') return `<p>${block.text}</p>`;
      if (block.type === 'list') {
        const items = block.items.map(item => `<li>${item}</li>`).join('');
        return `<${block.ordered ? 'ol' : 'ul'}>${items}</${block.ordered ? 'ol' : 'ul'}>`;
      }
      if (block.type === 'table') {
        const ths = block.headers.map(h => `<th>${h}</th>`).join('');
        const trs = block.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
        return `<div class="table-container"><table class="comparison-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
      }
      return '';
    }).join('\n');

    const guideCtaLink = pageData.ctaLink || '/';
    const guideCtaText = pageData.ctaText || 'Calculate FD Returns';

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span></h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="info-section">
    ${guideContentHTML}
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>${guideCtaText}</h3>
        <p>Use our free FD calculator to see your exact maturity amount, interest earned, and year-wise growth schedule.</p>
        <a href="${guideCtaLink}" class="calc-cta-btn">${guideCtaText} \u2192</a>
    </div>
</section>`;

  } else if (pageType === 'comparison-article') {
    // --- FD vs Debt Mutual Fund page ---
    const factors = comparisonFactors || [];
    const comparisonRows = factors.map(f => `<tr>
        <td class="bank-name">${f.factor}</td>
        <td>${f.fd}</td>
        <td>${f.debtMF}</td>
    </tr>`).join('');

    // Get avg FD rates for context
    const avgRate1Y = (banks.filter(b => b.fd['1-year']).reduce((sum, b) => sum + b.fd['1-year'].general, 0) / banks.filter(b => b.fd['1-year']).length).toFixed(2);
    const avgRate5Y = (banks.filter(b => b.fd['5-years']).reduce((sum, b) => sum + b.fd['5-years'].general, 0) / banks.filter(b => b.fd['5-years']).length).toFixed(2);

    content = `
<section class="page-hero">
    <h1><span class="hl">${heroTitle}</span> ${YEAR}</h1>
    <p>${heroSub}</p>
    <div class="updated">Updated: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
</section>

<!-- Ad: Below Hero -->
<div style="max-width:1200px;margin:0 auto 24px;padding:0 24px;text-align:center;">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<section class="comparison-section">
    <h2>FD vs Debt Mutual Fund \u2014 Side by Side Comparison</h2>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">A comprehensive comparison across 10 key factors to help you decide.</p>
    <div class="table-container">
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Factor</th>
                    <th>Fixed Deposit (FD)</th>
                    <th>Debt Mutual Fund</th>
                </tr>
            </thead>
            <tbody>
                ${comparisonRows}
            </tbody>
        </table>
    </div>
</section>

<section class="info-section">
    <h2>When to Choose Fixed Deposits</h2>
    <p>Fixed Deposits are the right choice when you prioritize capital safety and guaranteed returns. Current average FD rate: ${avgRate1Y}% (1-year) and ${avgRate5Y}% (5-year).</p>
    <ul>
        <li><strong>Emergency Fund:</strong> Keep 3-6 months\u2019 expenses in FDs for instant access</li>
        <li><strong>Senior Citizens:</strong> Higher FD rates (0.25-0.50% extra) provide reliable income</li>
        <li><strong>Short-term Goals:</strong> Goals within 1-2 years where you can\u2019t afford market risk</li>
        <li><strong>Tax Saving:</strong> 5-year tax-saving FD qualifies for Section 80C deduction</li>
        <li><strong>Risk-Averse Investors:</strong> Guaranteed returns regardless of market conditions</li>
    </ul>

    <h2>When to Choose Debt Mutual Funds</h2>
    <p>Debt Mutual Funds suit investors who want potentially higher returns and are comfortable with slight NAV fluctuations.</p>
    <ul>
        <li><strong>Higher Tax Bracket:</strong> Better post-tax returns for 30% slab investors (historically)</li>
        <li><strong>Medium-term Goals:</strong> 1-3 year goals where slight volatility is acceptable</li>
        <li><strong>No TDS:</strong> Unlike FDs, no TDS is deducted on debt fund redemptions</li>
        <li><strong>Flexibility:</strong> Easy to invest/redeem small amounts without penalty (post exit load period)</li>
        <li><strong>Portfolio Diversification:</strong> Complement equity investments for balanced allocation</li>
    </ul>
</section>

<section class="calc-cta">
    <div class="calc-cta-box">
        <h3>Calculate Your FD Returns</h3>
        <p>Compare what your money would earn in an FD at current bank rates. Use our free FD calculator.</p>
        <a href="/" class="calc-cta-btn">${ctaText} \u2192</a>
    </div>
</section>`;
  }

  // --- Internal links ---
  const otherAffiliateLinks = affiliateData.pages
    .filter(p => p.slug !== slug)
    .map(p => ({
      href: `/${p.slug}`,
      label: p.heroTitle,
      sub: '',
    }));

  const tenureLinks = Object.keys(TENURE_TYPES).map(t => ({
    href: `/${t}-fd-rates`,
    label: `${TENURE_TYPES[t].label} FD Rates`,
  }));

  const bankLinks = banks.slice(0, 8).map(b => ({
    href: `/${b.slug}-fd-calculator`,
    label: `${b.name} FD Calculator`,
  }));

  const links =
    linksGridHTML('More Comparisons', otherAffiliateLinks) +
    linksGridHTML('FD Rates by Tenure', tenureLinks) +
    linksGridHTML('Bank FD Calculators', bankLinks);

  // --- FAQ ---
  const faqItems = faqs.map(f => `
    <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
    </div>`).join('');

  const faqSection = `
<section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    ${faqItems}
</section>`;

  // --- Disclaimer ---
  const disclaimer = `
<div class="disclaimer">
    <div class="disclaimer-box">
        <strong>Disclaimer:</strong> FD interest rates and details shown on this page are sourced from official bank and NBFC websites and are for reference only. Actual rates may vary based on your deposit amount, tenure, and institution's internal policies. We may earn a referral commission when you apply through links on this page, at no extra cost to you. This does not affect our rankings or recommendations. Last verified: ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}.
    </div>
</div>`;

  const html = buildAffiliatePage({
    title,
    description,
    keywords,
    canonicalPath: slug,
    breadcrumb: breadcrumbHTML(bcItems = [
      { href: '/', label: 'Home' },
      { label: heroTitle },
    ]),
    breadcrumbItems: bcItems,
    content,
    faqSection,
    linksSection: links,
    disclaimer,
    jsonLd: faqSchemaJSON(faqs),
  });

  fs.writeFileSync(path.join(DIST, slug + '.html'), html);
  allPages.push(slug);
}

// ─── Sitemap & robots.txt ────────────────────────────────────────────────────

function generateSitemap() {
  const urls = [
    { loc: '', priority: '1.0', changefreq: 'weekly' },
    { loc: 'privacy', priority: '0.3', changefreq: 'yearly' },
    ...allPages.map(p => ({ loc: p, priority: p.includes('-for-') ? '0.6' : '0.8', changefreq: 'monthly' })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${DOMAIN}/${u.loc}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
}

function generateRobotsTxt() {
  const txt = `User-agent: *
Allow: /
Sitemap: ${DOMAIN}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST, 'robots.txt'), txt);
}

// ─── Build ───────────────────────────────────────────────────────────────────

console.log('\uD83D\uDD28 FD Batao — Programmatic SEO Build');
console.log('=====================================\n');

// Clean & create dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
ensureDir(DIST);

// Copy static files
console.log('\uD83D\uDCC4 Copying static files...');
['index.html', 'privacy.html', 'ads.txt'].forEach(f => {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
  }
});

// Generate tenure index pages
console.log('\uD83D\uDCC5 Generating tenure index pages...');
Object.keys(TENURE_TYPES).forEach(t => generateTenureIndexPage(t));
console.log(`   \u2192 ${Object.keys(TENURE_TYPES).length} tenure index pages`);

// Generate bank index pages
console.log('\uD83C\uDFE6 Generating bank index pages...');
banks.forEach(bank => generateBankIndexPage(bank));
console.log(`   \u2192 ${banks.length} bank index pages`);

// Generate bank+tenure pages
console.log('\uD83D\uDCCA Generating bank+tenure pages...');
let bankTenureCount = 0;
banks.forEach(bank => {
  Object.keys(TENURE_TYPES).forEach(t => {
    if (bank.fd[t]) {
      generateBankTenurePage(bank, t);
      bankTenureCount++;
    }
  });
});
console.log(`   \u2192 ${bankTenureCount} bank+tenure pages`);

// Generate tenure+amount pages
console.log('\uD83D\uDCB0 Generating tenure+amount pages...');
let tenureAmountCount = 0;
Object.keys(TENURE_TYPES).forEach(t => {
  AMOUNTS.forEach(amt => {
    generateTenureAmountPage(t, amt);
    tenureAmountCount++;
  });
});
console.log(`   \u2192 ${tenureAmountCount} tenure+amount pages`);

// Generate bank+tenure+amount pages
console.log('\uD83C\uDFE6\uD83D\uDCB0 Generating bank+tenure+amount pages...');
let bankTenureAmountCount = 0;
banks.forEach(bank => {
  Object.keys(TENURE_TYPES).forEach(t => {
    if (bank.fd[t]) {
      AMOUNTS.forEach(amt => {
        generateBankTenureAmountPage(bank, t, amt);
        bankTenureAmountCount++;
      });
    }
  });
});
console.log(`   \u2192 ${bankTenureAmountCount} bank+tenure+amount pages`);

// Generate affiliate pages
console.log('\uD83D\uDCDD Generating affiliate pages...');
affiliateData.pages.forEach(page => generateAffiliatePage(page));
console.log(`   \u2192 ${affiliateData.pages.length} affiliate pages`);

// Generate sitemap and robots.txt
console.log('\uD83D\uDDFA\uFE0F  Generating sitemap.xml and robots.txt...');
generateSitemap();
generateRobotsTxt();

// Summary
console.log(`\n\u2705 Build complete!`);
console.log(`   Total pages: ${allPages.length} generated + 3 static = ${allPages.length + 3}`);
console.log(`   Sitemap entries: ${allPages.length + 2}`);
console.log(`   Output: ${DIST}`);
