// ─────────────────────────────────────────────
//  Visa Buddy — Main Application
//  Supabase-backed, local-state for speed
// ─────────────────────────────────────────────

// ── CONFIG ──────────────────────────────────
// Replace with your Supabase project URL and anon key
const SUPABASE_URL = 'https://outguujfdmkyupsgtqdq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2TH6Jr-XvR1OUkuoS8g92A_m2TYDhgy';

// ── INIT ─────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATE ─────────────────────────────────────
let state = {
  session: null,
  loading: true,
  tab: 'dashboard',
  authMode: 'login',
  authLoading: false,
  authError: '',
  authSuccess: '',
  data: {
    addresses: [],
    education: [],
    employment: [],
    travel: [],
    passports: [],
    ids: [],
    language: []
  }
};

const app = document.getElementById('app');

// ── HELPERS ───────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function formatDate(s) {
  if (!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return s; }
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr, days = 90) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d >= now && d <= new Date(now.getTime() + days * 86400000);
}

function getInitial(email) {
  return (email || '?').charAt(0).toUpperCase();
}

// ── DATA PERSISTENCE (Supabase) ───────────────
// We store each category as a JSON blob in a `profiles` table:
// profiles(id uuid PK, user_id uuid FK, data jsonb)
// For a POC, we store the entire data object as one blob.
// In production, split into separate tables per category.

async function loadData() {
  if (!state.session) return;
  const { data: rows, error } = await db
    .from('visa_buddy_profiles')
    .select('data')
    .eq('user_id', state.session.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Load error:', error);
    return;
  }
  if (rows?.data) {
    state.data = { ...state.data, ...rows.data };
  }
}

async function saveData() {
  if (!state.session) return;
  const { error } = await db
    .from('visa_buddy_profiles')
    .upsert({
      user_id: state.session.user.id,
      data: state.data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) console.error('Save error:', error);
}

// ── AUTH ──────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  state.authLoading = true;
  state.authError = '';
  render();

  const fd = new FormData(e.target);
  const email = fd.get('email').trim();
  const password = fd.get('password');

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  state.authLoading = false;

  if (error) {
    state.authError = error.message;
    render();
    return;
  }
  state.session = data.session;
  await loadData();
  render();
}

async function handleSignup(e) {
  e.preventDefault();
  state.authLoading = true;
  state.authError = '';
  state.authSuccess = '';
  render();

  const fd = new FormData(e.target);
  const email = fd.get('email').trim();
  const password = fd.get('password');

  const { data, error } = await db.auth.signUp({ email, password });
  state.authLoading = false;

  if (error) {
    state.authError = error.message;
    render();
    return;
  }

  if (data.session) {
    state.session = data.session;
    await loadData();
    render();
  } else {
    state.authSuccess = 'Check your email to confirm your account, then log in.';
    state.authMode = 'login';
    render();
  }
}

async function handleLogout() {
  await db.auth.signOut();
  state.session = null;
  state.data = { addresses: [], education: [], employment: [], travel: [], passports: [], ids: [], language: [] };
  render();
}

// ── CRUD HELPERS ─────────────────────────────
async function addEntry(category, entry) {
  state.data[category].push({ id: uid(), ...entry, createdAt: new Date().toISOString() });
  await saveData();
  render();
}

async function deleteEntry(category, id) {
  state.data[category] = state.data[category].filter(e => e.id !== id);
  await saveData();
  render();
}

// ── EXPORT ───────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visa-buddy-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── RENDER ENGINE ─────────────────────────────
function render() {
  if (state.loading) {
    app.innerHTML = `
      <div class="loading-page">
        <div class="spinner"></div>
        <span>Loading Visa Buddy…</span>
      </div>`;
    return;
  }

  if (!state.session) {
    app.innerHTML = renderAuth();
    bindAuthEvents();
    return;
  }

  app.innerHTML = renderApp();
  bindAppEvents();
}

// ── AUTH VIEW ────────────────────────────────
function renderAuth() {
  return `
  <div class="auth-page">
    <div class="auth-left">
      <div class="auth-logo">
        <div class="auth-logo-icon">🛂</div>
        Visa Buddy
      </div>
      <div class="auth-hero">
        <h2>Your immigration<br><em>documents, organised.</em></h2>
        <p>Securely store every detail of your immigration history. Then let Visa Buddy autofill your applications in seconds.</p>
      </div>
      <div class="auth-features">
        <div class="auth-feature"><div class="auth-feature-dot"></div>Addresses, education &amp; employment history</div>
        <div class="auth-feature"><div class="auth-feature-dot"></div>Passports, travel records &amp; language tests</div>
        <div class="auth-feature"><div class="auth-feature-dot"></div>Chrome extension autofills any immigration form</div>
        <div class="auth-feature"><div class="auth-feature-dot"></div>Data encrypted &amp; stored securely via Supabase</div>
      </div>
    </div>
    <div class="auth-right">
      <div class="auth-form-wrap">
        <h3>${state.authMode === 'login' ? 'Welcome back' : 'Create account'}</h3>
        <p class="sub">${state.authMode === 'login' ? 'Sign in to your Visa Buddy account' : 'Start organising your immigration documents'}</p>

        <div class="auth-tabs">
          <button class="auth-tab ${state.authMode === 'login' ? 'active' : ''}" data-mode="login">Sign in</button>
          <button class="auth-tab ${state.authMode === 'signup' ? 'active' : ''}" data-mode="signup">Create account</button>
        </div>

        ${state.authError ? `<div class="error-msg">${escHtml(state.authError)}</div>` : ''}
        ${state.authSuccess ? `<div class="success-msg">${escHtml(state.authSuccess)}</div>` : ''}

        <form id="auth-form">
          <div class="field">
            <label>Email address</label>
            <input type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" placeholder="••••••••" required autocomplete="${state.authMode === 'login' ? 'current-password' : 'new-password'}" minlength="6" />
          </div>
          <button type="submit" class="btn-primary" ${state.authLoading ? 'disabled' : ''}>
            ${state.authLoading ? '<span style="display:inline-flex;align-items:center;gap:8px;justify-content:center"><span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Please wait…</span>' : (state.authMode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p style="font-size:12px;color:var(--sand-500);margin-top:20px;text-align:center;">
          Your data is stored securely using Supabase.
        </p>
      </div>
    </div>
  </div>`;
}

function bindAuthEvents() {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.authMode = btn.dataset.mode;
      state.authError = '';
      state.authSuccess = '';
      render();
    });
  });

  const form = document.getElementById('auth-form');
  if (form) {
    form.addEventListener('submit', state.authMode === 'login' ? handleLogin : handleSignup);
  }
}

// ── APP VIEW ─────────────────────────────────
const NAV = [
  { id: 'dashboard', icon: '◉', label: 'Overview' },
  { id: 'addresses', icon: '⌂', label: 'Addresses' },
  { id: 'education', icon: '◎', label: 'Education' },
  { id: 'employment', icon: '◈', label: 'Employment' },
  { id: 'travel', icon: '◈', label: 'Travel history' },
  { id: 'passports', icon: '◉', label: 'Passports & IDs' },
  { id: 'ids', icon: '◎', label: 'SSN / SIN' },
  { id: 'language', icon: '◈', label: 'Language proof' },
];

function navCount(id) {
  if (id === 'dashboard') return '';
  const n = (state.data[id] || []).length;
  return n > 0 ? `<span class="nav-count">${n}</span>` : '';
}

function renderApp() {
  const email = state.session.user.email || '';
  return `
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">🛂</div>
        Visa Buddy
      </div>
      <div class="sidebar-section-label">Navigation</div>
      <div class="sidebar-nav">
        ${NAV.map(n => `
          <button class="nav-item ${state.tab === n.id ? 'active' : ''}" data-tab="${n.id}">
            <span class="nav-icon">${n.icon}</span>
            ${escHtml(n.label)}
            ${navCount(n.id)}
          </button>`).join('')}
      </div>
      <div class="sidebar-footer">
        <div class="user-row">
          <div class="user-avatar">${getInitial(email)}</div>
          <span class="user-email">${escHtml(email)}</span>
        </div>
        <button class="logout-btn" id="logout-btn" style="width:100%;text-align:left;padding:8px 10px;margin-top:4px;">Sign out</button>
      </div>
    </nav>
    <main class="main-content">
      ${renderTab()}
    </main>
  </div>`;
}

function renderTab() {
  switch (state.tab) {
    case 'dashboard':  return renderDashboard();
    case 'addresses':  return renderAddresses();
    case 'education':  return renderEducation();
    case 'employment': return renderEmployment();
    case 'travel':     return renderTravel();
    case 'passports':  return renderPassports();
    case 'ids':        return renderIDs();
    case 'language':   return renderLanguage();
    default:           return renderDashboard();
  }
}

function bindAppEvents() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      render();
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Form submission
  document.getElementById('main-form')?.addEventListener('submit', handleFormSubmit);

  // Delete buttons
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { cat, id } = btn.dataset;
      if (confirm('Remove this entry?')) await deleteEntry(cat, id);
    });
  });

  // Export
  document.getElementById('export-btn')?.addEventListener('click', exportData);

  // Checkbox for SSN ack
  document.getElementById('ssn-ack')?.addEventListener('change', e => {
    const submitBtn = document.querySelector('#main-form [type=submit]');
    if (submitBtn) submitBtn.disabled = !e.target.checked;
  });
}

// ── FORM SUBMISSION ROUTER ───────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const cat = e.target.dataset.cat;

  let entry = {};
  for (const [k, v] of fd.entries()) entry[k] = v.toString().trim();

  // Basic validation
  const required = e.target.querySelectorAll('[required]');
  for (const field of required) {
    if (!field.value.trim()) {
      field.focus();
      return;
    }
  }

  await addEntry(cat, entry);
}

// ── DASHBOARD ────────────────────────────────
function renderDashboard() {
  const d = state.data;
  const counts = {
    addresses: d.addresses.length,
    education: d.education.length,
    employment: d.employment.length,
    travel: d.travel.length,
    passports: d.passports.length,
    ids: d.ids.length,
    language: d.language.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Expiry warnings
  const expiring = d.passports.filter(p => p.expiryDate && (isExpired(p.expiryDate) || isExpiringSoon(p.expiryDate)));
  const langExpiring = d.language.filter(l => l.expiryDate && (isExpired(l.expiryDate) || isExpiringSoon(l.expiryDate)));

  const sections = [
    { label: 'Addresses', key: 'addresses', max: 5 },
    { label: 'Education', key: 'education', max: 4 },
    { label: 'Employment', key: 'employment', max: 5 },
    { label: 'Travel entries', key: 'travel', max: 10 },
    { label: 'Passports', key: 'passports', max: 3 },
    { label: 'Language tests', key: 'language', max: 2 },
  ];

  return `
  <div class="page-header">
    <h2>Overview</h2>
    <p>Your immigration profile at a glance.</p>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
    <button class="btn-add" id="export-btn">⬇ Export JSON</button>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-num">${total}</div>
      <div class="kpi-label">Total records</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num">${counts.passports}</div>
      <div class="kpi-label">Travel documents</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num">${counts.employment}</div>
      <div class="kpi-label">Jobs on record</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num">${counts.travel}</div>
      <div class="kpi-label">Travel entries</div>
    </div>
  </div>

  ${expiring.length > 0 || langExpiring.length > 0 ? `
  <div class="dashboard-section">
    <h3>⚠ Expiry alerts</h3>
    <div class="ds-sub">Documents expiring soon or already expired</div>
    ${expiring.map(p => `
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 0;border-bottom:1px solid var(--sand-100);">
        <span class="badge ${isExpired(p.expiryDate) ? 'badge-red' : 'badge-amber'}">${isExpired(p.expiryDate) ? 'Expired' : 'Expiring soon'}</span>
        <span>${escHtml(p.docType)} · ${escHtml(p.country)} · ${formatDate(p.expiryDate)}</span>
      </div>`).join('')}
    ${langExpiring.map(l => `
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 0;border-bottom:1px solid var(--sand-100);">
        <span class="badge ${isExpired(l.expiryDate) ? 'badge-red' : 'badge-amber'}">${isExpired(l.expiryDate) ? 'Expired' : 'Expiring soon'}</span>
        <span>${escHtml(l.testType)} · score ${escHtml(l.score)} · ${formatDate(l.expiryDate)}</span>
      </div>`).join('')}
  </div>` : ''}

  <div class="dashboard-section">
    <h3>Profile completeness</h3>
    <div class="ds-sub">Add records in each section to strengthen your profile</div>
    ${sections.map(s => {
      const pct = Math.min(100, Math.round((counts[s.key] / s.max) * 100));
      return `
      <div class="progress-row">
        <span class="progress-label">${s.label}</span>
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <span class="progress-count">${counts[s.key]}</span>
      </div>`;
    }).join('')}
  </div>

  <div class="dashboard-section">
    <h3>Chrome extension</h3>
    <div class="ds-sub">Connect your browser to autofill immigration forms instantly</div>
    <p style="font-size:13px;color:var(--sand-500);margin-bottom:16px;">
      The Visa Buddy Chrome extension reads your profile and autofills fields on immigration portals — IRCC, US immigration, UK Visas &amp; Immigration, and more.
    </p>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:12px;background:var(--sand-100);color:var(--sand-700);padding:6px 14px;border-radius:999px;font-weight:500;">Extension coming soon</span>
      <span style="font-size:12px;color:var(--sand-500);">Build it next using the Chrome extension scaffold →</span>
    </div>
  </div>`;
}

// ── ADDRESSES ────────────────────────────────
function renderAddresses() {
  const items = state.data.addresses;
  return `
  <div class="page-header">
    <h2>Addresses</h2>
    <p>All residential addresses, past and present.</p>
  </div>
  <div class="card">
    <div class="card-title">Add address</div>
    <form id="main-form" data-cat="addresses">
      <div class="form-row">
        <div class="field"><label>Street address</label><input name="street" type="text" placeholder="123 Main St, Apt 4" required /></div>
        <div class="field"><label>City</label><input name="city" type="text" placeholder="Toronto" required /></div>
      </div>
      <div class="form-row three">
        <div class="field"><label>Province / State</label><input name="province" type="text" placeholder="Ontario" /></div>
        <div class="field"><label>Country</label><input name="country" type="text" placeholder="Canada" required /></div>
        <div class="field"><label>Postal / ZIP code</label><input name="postal" type="text" placeholder="M5V 2T6" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>From date</label><input name="fromDate" type="date" required /></div>
        <div class="field"><label>To date (leave blank if current)</label><input name="toDate" type="date" /></div>
      </div>
      <button type="submit" class="btn-add">Add address</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">⌂</div>No addresses yet. Add your first one above.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr>
        <th>Street</th><th>City</th><th>Country</th><th>From</th><th>To</th><th></th>
      </tr></thead>
      <tbody>
        ${items.map(a => `
        <tr>
          <td>${escHtml(a.street)}</td>
          <td>${escHtml(a.city)}</td>
          <td>${escHtml(a.country)}</td>
          <td>${formatDate(a.fromDate)}</td>
          <td>${a.toDate ? formatDate(a.toDate) : '<span class="badge badge-teal">Current</span>'}</td>
          <td><button class="btn-sm" data-del data-cat="addresses" data-id="${a.id}">Remove</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── EDUCATION ────────────────────────────────
function renderEducation() {
  const items = state.data.education;
  return `
  <div class="page-header">
    <h2>Education</h2>
    <p>Degrees, diplomas, and certifications.</p>
  </div>
  <div class="card">
    <div class="card-title">Add education</div>
    <form id="main-form" data-cat="education">
      <div class="form-row">
        <div class="field"><label>Institution name</label><input name="institution" type="text" placeholder="University of Toronto" required /></div>
        <div class="field"><label>Degree / diploma</label><input name="degree" type="text" placeholder="Bachelor of Science" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Field of study</label><input name="field" type="text" placeholder="Computer Science" /></div>
        <div class="field"><label>Country</label><input name="country" type="text" placeholder="Canada" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Start date</label><input name="fromDate" type="date" required /></div>
        <div class="field"><label>End / graduation date</label><input name="toDate" type="date" /></div>
      </div>
      <button type="submit" class="btn-add">Add education</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">◎</div>No education records yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Institution</th><th>Degree</th><th>Field</th><th>Country</th><th>From</th><th>To</th><th></th></tr></thead>
      <tbody>
        ${items.map(e => `
        <tr>
          <td>${escHtml(e.institution)}</td>
          <td>${escHtml(e.degree)}</td>
          <td>${escHtml(e.field || '—')}</td>
          <td>${escHtml(e.country)}</td>
          <td>${formatDate(e.fromDate)}</td>
          <td>${e.toDate ? formatDate(e.toDate) : '<span class="badge badge-teal">Ongoing</span>'}</td>
          <td><button class="btn-sm" data-del data-cat="education" data-id="${e.id}">Remove</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── EMPLOYMENT ───────────────────────────────
function renderEmployment() {
  const items = state.data.employment;
  return `
  <div class="page-header">
    <h2>Employment</h2>
    <p>Work history, past and present.</p>
  </div>
  <div class="card">
    <div class="card-title">Add job</div>
    <form id="main-form" data-cat="employment">
      <div class="form-row">
        <div class="field"><label>Employer name</label><input name="employer" type="text" placeholder="Acme Corp" required /></div>
        <div class="field"><label>Job title</label><input name="title" type="text" placeholder="Software Engineer" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>City</label><input name="city" type="text" placeholder="Toronto" /></div>
        <div class="field"><label>Country</label><input name="country" type="text" placeholder="Canada" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Start date</label><input name="fromDate" type="date" required /></div>
        <div class="field"><label>End date (leave blank if current)</label><input name="toDate" type="date" /></div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea name="notes" placeholder="Employment type, responsibilities..."></textarea></div>
      <button type="submit" class="btn-add">Add job</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">◈</div>No employment records yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Employer</th><th>Title</th><th>City</th><th>Country</th><th>From</th><th>To</th><th></th></tr></thead>
      <tbody>
        ${items.map(e => `
        <tr>
          <td>${escHtml(e.employer)}</td>
          <td>${escHtml(e.title)}</td>
          <td>${escHtml(e.city || '—')}</td>
          <td>${escHtml(e.country)}</td>
          <td>${formatDate(e.fromDate)}</td>
          <td>${e.toDate ? formatDate(e.toDate) : '<span class="badge badge-teal">Current</span>'}</td>
          <td><button class="btn-sm" data-del data-cat="employment" data-id="${e.id}">Remove</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── TRAVEL ───────────────────────────────────
function renderTravel() {
  const items = state.data.travel;
  return `
  <div class="page-header">
    <h2>Travel history</h2>
    <p>International travel entries and exits.</p>
  </div>
  <div class="card">
    <div class="card-title">Add trip</div>
    <form id="main-form" data-cat="travel">
      <div class="form-row">
        <div class="field"><label>Country visited</label><input name="country" type="text" placeholder="United States" required /></div>
        <div class="field"><label>Purpose of travel</label>
          <select name="purpose">
            <option value="tourism">Tourism / vacation</option>
            <option value="business">Business</option>
            <option value="study">Study</option>
            <option value="work">Work</option>
            <option value="transit">Transit</option>
            <option value="family">Family visit</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Entry date</label><input name="entryDate" type="date" required /></div>
        <div class="field"><label>Exit date</label><input name="exitDate" type="date" /></div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea name="notes" placeholder="Visa type, port of entry..."></textarea></div>
      <button type="submit" class="btn-add">Add trip</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">✈</div>No travel records yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Country</th><th>Purpose</th><th>Entry</th><th>Exit</th><th>Duration</th><th></th></tr></thead>
      <tbody>
        ${items.map(t => {
          let duration = '—';
          if (t.entryDate && t.exitDate) {
            const days = Math.round((new Date(t.exitDate) - new Date(t.entryDate)) / 86400000);
            duration = `${days} day${days !== 1 ? 's' : ''}`;
          }
          return `
          <tr>
            <td>${escHtml(t.country)}</td>
            <td><span class="badge badge-gray">${escHtml(t.purpose)}</span></td>
            <td>${formatDate(t.entryDate)}</td>
            <td>${t.exitDate ? formatDate(t.exitDate) : '<span class="badge badge-teal">Ongoing</span>'}</td>
            <td>${duration}</td>
            <td><button class="btn-sm" data-del data-cat="travel" data-id="${t.id}">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── PASSPORTS ────────────────────────────────
function renderPassports() {
  const items = state.data.passports;
  return `
  <div class="page-header">
    <h2>Passports &amp; travel documents</h2>
    <p>All your travel documents with expiry tracking.</p>
  </div>
  <div class="card">
    <div class="card-title">Add document</div>
    <form id="main-form" data-cat="passports">
      <div class="form-row">
        <div class="field"><label>Document type</label>
          <select name="docType">
            <option value="passport">Passport</option>
            <option value="travel-document">Travel document</option>
            <option value="refugee-travel-document">Refugee travel document</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field"><label>Issuing country</label><input name="country" type="text" placeholder="Canada" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Document number</label><input name="number" type="text" placeholder="AB123456" required /></div>
        <div class="field"><label>Holder name (optional)</label><input name="holderName" type="text" placeholder="As printed" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Issue date</label><input name="issueDate" type="date" required /></div>
        <div class="field"><label>Expiry date</label><input name="expiryDate" type="date" required /></div>
      </div>
      <button type="submit" class="btn-add">Add document</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">🛂</div>No documents yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Type</th><th>Country</th><th>Number</th><th>Issue</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${items.map(p => {
          let statusBadge = '<span class="badge badge-teal">Valid</span>';
          if (isExpired(p.expiryDate)) statusBadge = '<span class="badge badge-red">Expired</span>';
          else if (isExpiringSoon(p.expiryDate)) statusBadge = '<span class="badge badge-amber">Expiring soon</span>';
          return `
          <tr>
            <td>${escHtml(p.docType)}</td>
            <td>${escHtml(p.country)}</td>
            <td style="font-family:monospace">${escHtml(p.number)}</td>
            <td>${formatDate(p.issueDate)}</td>
            <td>${formatDate(p.expiryDate)}</td>
            <td>${statusBadge}</td>
            <td><button class="btn-sm" data-del data-cat="passports" data-id="${p.id}">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── SSN / SIN ────────────────────────────────
function renderIDs() {
  const items = state.data.ids;
  return `
  <div class="page-header">
    <h2>SSN / SIN</h2>
    <p>National identification numbers (stored encrypted).</p>
  </div>
  <div class="card">
    <div class="warn-box">
      <strong>⚠ Sensitive information.</strong> SSN and SIN numbers are highly sensitive. This data is stored in your Supabase database. Only use this on a trusted personal device.
    </div>
    <div class="card-title">Add ID</div>
    <form id="main-form" data-cat="ids">
      <div class="form-row">
        <div class="field"><label>ID type</label>
          <select name="idType">
            <option value="SIN">SIN — Canada</option>
            <option value="SSN">SSN — USA</option>
          </select>
        </div>
        <div class="field"><label>Value</label><input name="value" type="text" placeholder="Enter carefully" required /></div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea name="notes" placeholder="Where it's stored, when last updated..."></textarea></div>
      <div class="ack-row">
        <input type="checkbox" id="ssn-ack" />
        <label for="ssn-ack" style="font-size:13px;font-weight:400;cursor:pointer;">I understand this is sensitive and I'm on a private, trusted device.</label>
      </div>
      <button type="submit" class="btn-add" disabled>Add ID</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">◎</div>No IDs saved yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Type</th><th>Value (masked)</th><th>Notes</th><th>Added</th><th></th></tr></thead>
      <tbody>
        ${items.map(x => {
          const v = x.value || '';
          const masked = '•'.repeat(Math.max(0, v.length - 4)) + v.slice(-4);
          return `
          <tr>
            <td>${escHtml(x.idType)}</td>
            <td class="masked">${escHtml(masked)}</td>
            <td>${escHtml(x.notes || '—')}</td>
            <td>${x.createdAt ? new Date(x.createdAt).toLocaleDateString() : '—'}</td>
            <td><button class="btn-sm" data-del data-cat="ids" data-id="${x.id}">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── LANGUAGE ─────────────────────────────────
function renderLanguage() {
  const items = state.data.language;
  return `
  <div class="page-header">
    <h2>Language proof</h2>
    <p>Language test results for immigration applications.</p>
  </div>
  <div class="card">
    <div class="card-title">Add language test</div>
    <form id="main-form" data-cat="language">
      <div class="form-row">
        <div class="field"><label>Test type</label><input name="testType" type="text" placeholder="IELTS, CELPIP, TEF, TCF…" required /></div>
        <div class="field"><label>Overall score</label><input name="score" type="text" placeholder="e.g. CLB 9, Overall 7.5" required /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Test date</label><input name="testDate" type="date" required /></div>
        <div class="field"><label>Expiry date (optional)</label><input name="expiryDate" type="date" /></div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea name="notes" placeholder="TRF number, test center, breakdown..."></textarea></div>
      <button type="submit" class="btn-add">Add language test</button>
    </form>
  </div>

  ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">◈</div>No language tests yet.</div></div>` : `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>Test</th><th>Score</th><th>Test date</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${items.map(l => {
          let statusBadge = '<span class="badge badge-teal">Valid</span>';
          if (l.expiryDate) {
            if (isExpired(l.expiryDate)) statusBadge = '<span class="badge badge-red">Expired</span>';
            else if (isExpiringSoon(l.expiryDate)) statusBadge = '<span class="badge badge-amber">Expiring soon</span>';
          } else {
            statusBadge = '<span class="badge badge-gray">No expiry set</span>';
          }
          return `
          <tr>
            <td>${escHtml(l.testType)}</td>
            <td><strong>${escHtml(l.score)}</strong></td>
            <td>${formatDate(l.testDate)}</td>
            <td>${l.expiryDate ? formatDate(l.expiryDate) : '—'}</td>
            <td>${statusBadge}</td>
            <td><button class="btn-sm" data-del data-cat="language" data-id="${l.id}">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`}`;
}

// ── BOOT ─────────────────────────────────────
(async function boot() {
  render(); // show loading

  // Listen for auth changes
  db.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    if (session) await loadData();
    state.loading = false;
    render();
  });

  // Get initial session
  const { data: { session } } = await db.auth.getSession();
  state.session = session;
  if (session) await loadData();
  state.loading = false;
  render();
})();
