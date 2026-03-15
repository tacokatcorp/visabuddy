// ─────────────────────────────────────────────
//  Visa Buddy — Main Application
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://outguujfdmkyupsgtqdq.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_2TH6Jr-XvR1OUkuoS8g92A_m2TYDhgy';

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
  saving: false,
  editModal: null,
  data: {
    addresses: [], education: [], employment: [],
    travel: [], passports: [], ids: [], language: []
  }
};

const app = document.getElementById('app');

// ── HELPERS ───────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function formatDate(s) {
  if (!s) return '—';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return s; }
}

function isExpired(d) { return d ? new Date(d) < new Date() : false; }

function isExpiringSoon(d, days = 90) {
  if (!d) return false;
  const dt = new Date(d), now = new Date();
  return dt >= now && dt <= new Date(now.getTime() + days * 86400000);
}

function getInitial(email) { return (email || '?').charAt(0).toUpperCase(); }

// ── SUPABASE ──────────────────────────────────
async function loadData() {
  if (!state.session) return;
  const { data: row, error } = await db
    .from('visa_buddy_profiles')
    .select('data')
    .eq('user_id', state.session.user.id)
    .single();
  if (error && error.code !== 'PGRST116') { console.error('Load error:', error); return; }
  if (row?.data) state.data = { ...state.data, ...row.data };
}

async function saveData() {
  if (!state.session) return;
  renderSaveIndicator('saving');
  const { error } = await db
    .from('visa_buddy_profiles')
    .upsert({ user_id: state.session.user.id, data: state.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { console.error('Save error:', error); renderSaveIndicator('error'); }
  else renderSaveIndicator('saved');
}

function renderSaveIndicator(status) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  if (status === 'saving') { el.textContent = '● Saving…'; el.style.color = 'var(--sand-500)'; }
  else if (status === 'error') { el.textContent = '✕ Save failed'; el.style.color = 'var(--accent)'; }
  else { el.textContent = '✓ Saved'; el.style.color = 'var(--teal-500)'; setTimeout(() => { const e = document.getElementById('save-indicator'); if (e) e.textContent = ''; }, 2500); }
}

// ── AUTH ──────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  state.authLoading = true; state.authError = ''; render();
  const fd = new FormData(e.target);
  const { data, error } = await db.auth.signInWithPassword({ email: fd.get('email').trim(), password: fd.get('password') });
  state.authLoading = false;
  if (error) { state.authError = error.message; render(); return; }
  state.session = data.session;
  await loadData(); render();
}

async function handleSignup(e) {
  e.preventDefault();
  state.authLoading = true; state.authError = ''; state.authSuccess = ''; render();
  const fd = new FormData(e.target);
  const { data, error } = await db.auth.signUp({ email: fd.get('email').trim(), password: fd.get('password') });
  state.authLoading = false;
  if (error) { state.authError = error.message; render(); return; }
  if (data.session) { state.session = data.session; await loadData(); render(); }
  else { state.authSuccess = 'Check your email to confirm your account, then log in.'; state.authMode = 'login'; render(); }
}

async function handleLogout() {
  await db.auth.signOut();
  state.session = null;
  state.data = { addresses: [], education: [], employment: [], travel: [], passports: [], ids: [], language: [] };
  render();
}

// ── CRUD ──────────────────────────────────────
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

async function updateEntry(category, id, updates) {
  state.data[category] = state.data[category].map(e => e.id === id ? { ...e, ...updates } : e);
  state.editModal = null;
  await saveData();
  render();
}

// ── EXPORT ────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `visa-buddy-${new Date().toISOString().slice(0,10)}.json` });
  a.click(); URL.revokeObjectURL(url);
}

// ── RENDER ────────────────────────────────────
function render() {
  if (state.loading) {
    app.innerHTML = `<div class="loading-page"><div class="spinner"></div><span>Loading Visa Buddy…</span></div>`;
    return;
  }
  if (!state.session) { app.innerHTML = renderAuth(); bindAuthEvents(); return; }
  app.innerHTML = renderApp();
  bindAppEvents();
}

// ── AUTH VIEW ─────────────────────────────────
function renderAuth() {
  return `
  <div class="auth-page">
    <div class="auth-left">
      <div class="auth-logo"><div class="auth-logo-icon">🛂</div>Visa Buddy</div>
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
          <div class="field"><label>Email address</label><input type="email" name="email" placeholder="you@example.com" required autocomplete="email" /></div>
          <div class="field"><label>Password</label><input type="password" name="password" placeholder="••••••••" required minlength="6" /></div>
          <button type="submit" class="btn-primary" ${state.authLoading ? 'disabled' : ''}>
            ${state.authLoading
              ? '<span style="display:inline-flex;align-items:center;gap:8px;justify-content:center"><span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Please wait…</span>'
              : (state.authMode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
        <p style="font-size:12px;color:var(--sand-500);margin-top:20px;text-align:center;">Your data is stored securely using Supabase.</p>
      </div>
    </div>
  </div>`;
}

function bindAuthEvents() {
  document.querySelectorAll('.auth-tab').forEach(btn => btn.addEventListener('click', () => {
    state.authMode = btn.dataset.mode; state.authError = ''; state.authSuccess = ''; render();
  }));
  const form = document.getElementById('auth-form');
  if (form) form.addEventListener('submit', state.authMode === 'login' ? handleLogin : handleSignup);
}

// ── APP SHELL ─────────────────────────────────
const NAV = [
  { id: 'dashboard',  icon: '◉', label: 'Overview' },
  { id: 'addresses',  icon: '⌂', label: 'Addresses' },
  { id: 'education',  icon: '◎', label: 'Education' },
  { id: 'employment', icon: '◈', label: 'Employment' },
  { id: 'travel',     icon: '◈', label: 'Travel history' },
  { id: 'passports',  icon: '◉', label: 'Passports & IDs' },
  { id: 'ids',        icon: '◎', label: 'SSN / SIN' },
  { id: 'language',   icon: '◈', label: 'Language proof' },
];

function renderApp() {
  const email = state.session.user.email || '';
  return `
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-logo"><div class="sidebar-logo-icon">🛂</div>Visa Buddy</div>
      <div class="sidebar-section-label">Navigation</div>
      <div class="sidebar-nav">
        ${NAV.map(n => `
          <button class="nav-item ${state.tab === n.id ? 'active' : ''}" data-tab="${n.id}">
            <span class="nav-icon">${n.icon}</span>${escHtml(n.label)}
            ${n.id !== 'dashboard' && (state.data[n.id]||[]).length > 0
              ? `<span class="nav-count">${state.data[n.id].length}</span>` : ''}
          </button>`).join('')}
      </div>
      <div class="sidebar-footer">
        <div class="user-row">
          <div class="user-avatar">${getInitial(email)}</div>
          <span class="user-email">${escHtml(email)}</span>
          <span id="save-indicator" style="font-size:11px;margin-left:auto;white-space:nowrap;transition:color 0.2s;"></span>
        </div>
        <button id="logout-btn" class="logout-btn" style="width:100%;text-align:left;padding:8px 10px;margin-top:4px;">Sign out</button>
      </div>
    </nav>
    <main class="main-content">${renderTab()}</main>
  </div>

  <!-- Edit modal -->
  <div id="edit-overlay" style="display:none;position:fixed;inset:0;background:rgba(42,35,24,0.5);z-index:200;align-items:center;justify-content:center;padding:20px;">
    <div id="edit-modal" style="background:white;border-radius:18px;padding:28px;width:100%;max-width:580px;max-height:88vh;overflow-y:auto;box-shadow:0 24px 64px rgba(42,35,24,0.28);"></div>
  </div>`;
}

function renderTab() {
  switch (state.tab) {
    case 'dashboard':  return renderDashboard();
    case 'addresses':  return renderSection('addresses');
    case 'education':  return renderSection('education');
    case 'employment': return renderSection('employment');
    case 'travel':     return renderSection('travel');
    case 'passports':  return renderSection('passports');
    case 'ids':        return renderSection('ids');
    case 'language':   return renderSection('language');
    default:           return renderDashboard();
  }
}

function bindAppEvents() {
  // Nav tabs
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
    btn.addEventListener('click', () => { state.tab = btn.dataset.tab; render(); }));

  // Sidebar actions
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('export-btn')?.addEventListener('click', exportData);

  // Add form submit
  const addForm = document.getElementById('add-form');
  if (addForm) {
    addForm.addEventListener('submit', async e => {
      e.preventDefault();
      const cat = addForm.dataset.cat;

      // SSN/SIN ack
      if (cat === 'ids' && !document.getElementById('ssn-ack')?.checked) return;

      // Collect fields
      const fd = new FormData(addForm);
      const entry = {};
      for (const [k, v] of fd.entries()) entry[k] = v.toString().trim();

      const btn = addForm.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      await addEntry(cat, entry);
      // render() inside addEntry resets the form automatically
    });
  }

  // SSN ack checkbox enables submit
  document.getElementById('ssn-ack')?.addEventListener('change', e => {
    const btn = document.querySelector('#add-form [type=submit]');
    if (btn) btn.disabled = !e.target.checked;
  });

  // Delete buttons — using class selector, not attribute
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this entry?')) return;
      btn.textContent = '…';
      btn.disabled = true;
      await deleteEntry(btn.dataset.cat, btn.dataset.id);
    });
  });

  // Edit buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.cat, btn.dataset.id));
  });

  // Close modal on overlay click
  document.getElementById('edit-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'edit-overlay') closeEditModal();
  });
}

// ── EDIT MODAL ────────────────────────────────
function openEditModal(cat, id) {
  const overlay = document.getElementById('edit-overlay');
  const modal = document.getElementById('edit-modal');
  if (!overlay || !modal) return;

  const item = (state.data[cat] || []).find(e => e.id === id);
  if (!item) return;

  const catLabels = {
    addresses:'Edit address', education:'Edit education', employment:'Edit job',
    travel:'Edit trip', passports:'Edit document', ids:'Edit ID', language:'Edit language test'
  };

  const defs = getFieldDefs(cat);
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
      <h3 style="font-size:22px;">${catLabels[cat]}</h3>
      <button id="modal-close-btn" style="background:none;border:none;cursor:pointer;font-size:22px;color:var(--sand-500);line-height:1;padding:4px;">✕</button>
    </div>
    <form id="edit-form">
      ${defs.map(row => `
        <div class="form-row ${row.length === 3 ? 'three' : ''}">
          ${row.map(f => buildFieldHtml(f, item[f.name] || '')).join('')}
        </div>`).join('')}
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button type="submit" class="btn-add">Save changes</button>
        <button type="button" id="modal-cancel-btn" style="padding:10px 18px;background:none;border:1.5px solid var(--sand-200);border-radius:var(--radius-sm);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--sand-700);">Cancel</button>
      </div>
    </form>`;

  overlay.style.display = 'flex';

  document.getElementById('modal-close-btn')?.addEventListener('click', closeEditModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeEditModal);

  document.getElementById('edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = {};
    for (const [k, v] of fd.entries()) updates[k] = v.toString().trim();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…';
    await updateEntry(cat, id, updates);
    closeEditModal();
  });
}

function closeEditModal() {
  const overlay = document.getElementById('edit-overlay');
  if (overlay) overlay.style.display = 'none';
}

function buildFieldHtml(f, value) {
  if (f.type === 'select') {
    return `<div class="field"><label>${escHtml(f.label)}</label>
      <select name="${f.name}">
        ${f.options.map(o => `<option value="${escHtml(o.value)}"${value === o.value ? ' selected' : ''}>${escHtml(o.label)}</option>`).join('')}
      </select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="field"><label>${escHtml(f.label)}</label>
      <textarea name="${f.name}" placeholder="${escHtml(f.placeholder||'')}">${escHtml(value)}</textarea></div>`;
  }
  return `<div class="field"><label>${escHtml(f.label)}</label>
    <input type="${f.type||'text'}" name="${f.name}" value="${escHtml(value)}" placeholder="${escHtml(f.placeholder||'')}"${f.required ? ' required' : ''} /></div>`;
}

// ── FIELD DEFINITIONS ─────────────────────────
function getFieldDefs(cat) {
  switch (cat) {
    case 'addresses': return [
      [{name:'street',label:'Street address',placeholder:'123 Main St',required:true},{name:'city',label:'City',placeholder:'Toronto',required:true}],
      [{name:'province',label:'Province / State',placeholder:'Ontario'},{name:'country',label:'Country',placeholder:'Canada',required:true},{name:'postal',label:'Postal / ZIP',placeholder:'M5V 2T6'}],
      [{name:'fromDate',label:'From date',type:'date',required:true},{name:'toDate',label:'To date (blank = current)',type:'date'}]
    ];
    case 'education': return [
      [{name:'institution',label:'Institution',placeholder:'University of Toronto',required:true},{name:'degree',label:'Degree / diploma',placeholder:'Bachelor of Science',required:true}],
      [{name:'field',label:'Field of study',placeholder:'Computer Science'},{name:'country',label:'Country',placeholder:'Canada',required:true}],
      [{name:'fromDate',label:'Start date',type:'date',required:true},{name:'toDate',label:'End / graduation date',type:'date'}]
    ];
    case 'employment': return [
      [{name:'employer',label:'Employer',placeholder:'Acme Corp',required:true},{name:'title',label:'Job title',placeholder:'Software Engineer',required:true}],
      [{name:'city',label:'City',placeholder:'Toronto'},{name:'country',label:'Country',placeholder:'Canada',required:true}],
      [{name:'fromDate',label:'Start date',type:'date',required:true},{name:'toDate',label:'End date (blank = current)',type:'date'}],
      [{name:'notes',label:'Notes (optional)',type:'textarea',placeholder:'Employment type, responsibilities…'}]
    ];
    case 'travel': return [
      [{name:'country',label:'Country visited',placeholder:'United States',required:true},
       {name:'purpose',label:'Purpose',type:'select',options:[
         {value:'tourism',label:'Tourism / vacation'},{value:'business',label:'Business'},
         {value:'study',label:'Study'},{value:'work',label:'Work'},
         {value:'transit',label:'Transit'},{value:'family',label:'Family visit'},{value:'other',label:'Other'}]}],
      [{name:'entryDate',label:'Entry date',type:'date',required:true},{name:'exitDate',label:'Exit date',type:'date'}],
      [{name:'notes',label:'Notes (optional)',type:'textarea',placeholder:'Visa type, port of entry…'}]
    ];
    case 'passports': return [
      [{name:'docType',label:'Document type',type:'select',options:[
         {value:'passport',label:'Passport'},{value:'travel-document',label:'Travel document'},
         {value:'refugee-travel-document',label:'Refugee travel document'},{value:'other',label:'Other'}]},
       {name:'country',label:'Issuing country',placeholder:'Canada',required:true}],
      [{name:'number',label:'Document number',placeholder:'AB123456',required:true},{name:'holderName',label:'Holder name (optional)',placeholder:'As printed'}],
      [{name:'issueDate',label:'Issue date',type:'date',required:true},{name:'expiryDate',label:'Expiry date',type:'date',required:true}]
    ];
    case 'ids': return [
      [{name:'idType',label:'ID type',type:'select',options:[{value:'SIN',label:'SIN — Canada'},{value:'SSN',label:'SSN — USA'}]},
       {name:'value',label:'Value',placeholder:'Enter carefully',required:true}],
      [{name:'notes',label:'Notes (optional)',type:'textarea',placeholder:'Where stored, last updated…'}]
    ];
    case 'language': return [
      [{name:'testType',label:'Test type',placeholder:'IELTS, CELPIP, TEF…',required:true},{name:'score',label:'Overall score',placeholder:'e.g. CLB 9, Overall 7.5',required:true}],
      [{name:'testDate',label:'Test date',type:'date',required:true},{name:'expiryDate',label:'Expiry date (optional)',type:'date'}],
      [{name:'notes',label:'Notes (optional)',type:'textarea',placeholder:'TRF number, test center…'}]
    ];
    default: return [];
  }
}

// ── SECTION RENDERER ──────────────────────────
function renderAddForm(cat) {
  const defs = getFieldDefs(cat);
  const btnLabels = {
    addresses:'Add address', education:'Add education', employment:'Add job',
    travel:'Add trip', passports:'Add document', ids:'Add ID', language:'Add language test'
  };
  const sectionTitles = {
    addresses:'Add address', education:'Add education', employment:'Add job',
    travel:'Add trip', passports:'Add document', ids:'Add ID', language:'Add language test'
  };
  return `
  <div class="card">
    ${cat === 'ids' ? `<div class="warn-box"><strong>⚠ Sensitive information.</strong> SSN/SIN numbers are highly sensitive. Only use on a trusted private device.</div>` : ''}
    <div class="card-title">${sectionTitles[cat]}</div>
    <form id="add-form" data-cat="${cat}">
      ${defs.map(row => `
        <div class="form-row ${row.length === 3 ? 'three' : ''}">
          ${row.map(f => buildFieldHtml(f, '')).join('')}
        </div>`).join('')}
      ${cat === 'ids' ? `<div class="ack-row"><input type="checkbox" id="ssn-ack"/><label for="ssn-ack" style="font-size:13px;font-weight:400;cursor:pointer;">I understand this is sensitive and I'm on a private, trusted device.</label></div>` : ''}
      <button type="submit" class="btn-add"${cat === 'ids' ? ' disabled' : ''}>${btnLabels[cat]}</button>
    </form>
  </div>`;
}

function actionCell(cat, id) {
  return `<td style="white-space:nowrap;">
    <button class="btn-edit btn-sm" data-cat="${cat}" data-id="${id}" style="margin-right:4px;">Edit</button>
    <button class="btn-delete btn-sm" data-cat="${cat}" data-id="${id}">Remove</button>
  </td>`;
}

function renderSection(cat) {
  const titles = { addresses:'Addresses', education:'Education', employment:'Employment',
    travel:'Travel history', passports:'Passports & travel documents', ids:'SSN / SIN', language:'Language proof' };
  const subtitles = { addresses:'All residential addresses, past and present.',
    education:'Degrees, diplomas, and certifications.', employment:'Work history, past and present.',
    travel:'International travel entries and exits.', passports:'All your travel documents with expiry tracking.',
    ids:'National identification numbers.', language:'Language test results for immigration applications.' };
  const columnHeaders = {
    addresses:  ['Street','City','Province','Country','Postal','From','To',''],
    education:  ['Institution','Degree','Field','Country','From','To',''],
    employment: ['Employer','Title','City','Country','From','To',''],
    travel:     ['Country','Purpose','Entry','Exit','Duration',''],
    passports:  ['Type','Country','Number','Issue','Expiry','Status',''],
    ids:        ['Type','Value (masked)','Notes','Added',''],
    language:   ['Test','Score','Test date','Expiry','Status',''],
  };

  const items = state.data[cat] || [];
  return `
  <div class="page-header">
    <h2>${escHtml(titles[cat])}</h2>
    <p>${escHtml(subtitles[cat])}</p>
  </div>
  ${renderAddForm(cat)}
  ${items.length === 0
    ? `<div class="card"><div class="empty-state"><div class="empty-icon">○</div>No entries yet. Add your first one above.</div></div>`
    : `<div class="card" style="padding:0;overflow:hidden;">
        <table class="data-table">
          <thead><tr>${columnHeaders[cat].map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${items.map(item => renderRow(cat, item)).join('')}</tbody>
        </table>
      </div>`}`;
}

function renderRow(cat, item) {
  switch (cat) {
    case 'addresses': return `<tr>
      <td>${escHtml(item.street)}</td><td>${escHtml(item.city)}</td>
      <td>${escHtml(item.province||'—')}</td><td>${escHtml(item.country)}</td>
      <td>${escHtml(item.postal||'—')}</td><td>${formatDate(item.fromDate)}</td>
      <td>${item.toDate ? formatDate(item.toDate) : '<span class="badge badge-teal">Current</span>'}</td>
      ${actionCell('addresses', item.id)}</tr>`;
    case 'education': return `<tr>
      <td>${escHtml(item.institution)}</td><td>${escHtml(item.degree)}</td>
      <td>${escHtml(item.field||'—')}</td><td>${escHtml(item.country)}</td>
      <td>${formatDate(item.fromDate)}</td>
      <td>${item.toDate ? formatDate(item.toDate) : '<span class="badge badge-teal">Ongoing</span>'}</td>
      ${actionCell('education', item.id)}</tr>`;
    case 'employment': return `<tr>
      <td>${escHtml(item.employer)}</td><td>${escHtml(item.title)}</td>
      <td>${escHtml(item.city||'—')}</td><td>${escHtml(item.country)}</td>
      <td>${formatDate(item.fromDate)}</td>
      <td>${item.toDate ? formatDate(item.toDate) : '<span class="badge badge-teal">Current</span>'}</td>
      ${actionCell('employment', item.id)}</tr>`;
    case 'travel': {
      let dur = '—';
      if (item.entryDate && item.exitDate) {
        const d = Math.round((new Date(item.exitDate) - new Date(item.entryDate)) / 86400000);
        dur = `${d} day${d !== 1 ? 's' : ''}`;
      }
      return `<tr>
        <td>${escHtml(item.country)}</td>
        <td><span class="badge badge-gray">${escHtml(item.purpose)}</span></td>
        <td>${formatDate(item.entryDate)}</td>
        <td>${item.exitDate ? formatDate(item.exitDate) : '<span class="badge badge-teal">Ongoing</span>'}</td>
        <td>${dur}</td>${actionCell('travel', item.id)}</tr>`;
    }
    case 'passports': {
      let badge = '<span class="badge badge-teal">Valid</span>';
      if (isExpired(item.expiryDate)) badge = '<span class="badge badge-red">Expired</span>';
      else if (isExpiringSoon(item.expiryDate)) badge = '<span class="badge badge-amber">Expiring soon</span>';
      return `<tr>
        <td>${escHtml(item.docType)}</td><td>${escHtml(item.country)}</td>
        <td style="font-family:monospace">${escHtml(item.number)}</td>
        <td>${formatDate(item.issueDate)}</td><td>${formatDate(item.expiryDate)}</td>
        <td>${badge}</td>${actionCell('passports', item.id)}</tr>`;
    }
    case 'ids': {
      const v = item.value || '';
      const masked = '•'.repeat(Math.max(0, v.length - 4)) + v.slice(-4);
      return `<tr>
        <td>${escHtml(item.idType)}</td>
        <td class="masked">${escHtml(masked)}</td>
        <td>${escHtml(item.notes||'—')}</td>
        <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
        ${actionCell('ids', item.id)}</tr>`;
    }
    case 'language': {
      let badge = '<span class="badge badge-gray">No expiry</span>';
      if (item.expiryDate) {
        badge = isExpired(item.expiryDate) ? '<span class="badge badge-red">Expired</span>'
          : isExpiringSoon(item.expiryDate) ? '<span class="badge badge-amber">Expiring soon</span>'
          : '<span class="badge badge-teal">Valid</span>';
      }
      return `<tr>
        <td>${escHtml(item.testType)}</td><td><strong>${escHtml(item.score)}</strong></td>
        <td>${formatDate(item.testDate)}</td>
        <td>${item.expiryDate ? formatDate(item.expiryDate) : '—'}</td>
        <td>${badge}</td>${actionCell('language', item.id)}</tr>`;
    }
    default: return '';
  }
}

// ── DASHBOARD ─────────────────────────────────
function renderDashboard() {
  const d = state.data;
  const counts = { addresses:d.addresses.length, education:d.education.length, employment:d.employment.length,
    travel:d.travel.length, passports:d.passports.length, ids:d.ids.length, language:d.language.length };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const expiring = d.passports.filter(p => p.expiryDate && (isExpired(p.expiryDate) || isExpiringSoon(p.expiryDate)));
  const langExpiring = d.language.filter(l => l.expiryDate && (isExpired(l.expiryDate) || isExpiringSoon(l.expiryDate)));
  const sections = [
    {label:'Addresses',key:'addresses',max:5},{label:'Education',key:'education',max:4},
    {label:'Employment',key:'employment',max:5},{label:'Travel entries',key:'travel',max:10},
    {label:'Passports',key:'passports',max:3},{label:'Language tests',key:'language',max:2},
  ];
  return `
  <div class="page-header"><h2>Overview</h2><p>Your immigration profile at a glance.</p></div>
  <div style="margin-bottom:24px;">
    <button class="btn-add" id="export-btn">⬇ Export JSON</button>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-num">${total}</div><div class="kpi-label">Total records</div></div>
    <div class="kpi-card"><div class="kpi-num">${counts.passports}</div><div class="kpi-label">Travel documents</div></div>
    <div class="kpi-card"><div class="kpi-num">${counts.employment}</div><div class="kpi-label">Jobs on record</div></div>
    <div class="kpi-card"><div class="kpi-num">${counts.travel}</div><div class="kpi-label">Travel entries</div></div>
  </div>
  ${expiring.length > 0 || langExpiring.length > 0 ? `
  <div class="dashboard-section">
    <h3>⚠ Expiry alerts</h3><div class="ds-sub">Documents expiring soon or already expired</div>
    ${[...expiring.map(p => ({label:`${p.docType} · ${p.country} · ${formatDate(p.expiryDate)}`, exp:p.expiryDate})),
       ...langExpiring.map(l => ({label:`${l.testType} · score ${l.score} · ${formatDate(l.expiryDate)}`, exp:l.expiryDate}))
    ].map(a => `<div style="display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 0;border-bottom:1px solid var(--sand-100);">
      <span class="badge ${isExpired(a.exp) ? 'badge-red' : 'badge-amber'}">${isExpired(a.exp) ? 'Expired' : 'Expiring soon'}</span>
      <span>${escHtml(a.label)}</span></div>`).join('')}
  </div>` : ''}
  <div class="dashboard-section">
    <h3>Profile completeness</h3><div class="ds-sub">Add records in each section to build a stronger profile</div>
    ${sections.map(s => {
      const pct = Math.min(100, Math.round((counts[s.key] / s.max) * 100));
      return `<div class="progress-row">
        <span class="progress-label">${s.label}</span>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
        <span class="progress-count">${counts[s.key]}</span></div>`;
    }).join('')}
  </div>
  <div class="dashboard-section">
    <h3>Chrome extension</h3><div class="ds-sub">Autofill immigration forms with one click</div>
    <p style="font-size:13px;color:var(--sand-500);margin-bottom:16px;">Install the Visa Buddy Chrome extension to autofill IRCC, USCIS, and other immigration forms automatically.</p>
    <span style="font-size:12px;background:var(--sand-100);color:var(--sand-700);padding:6px 14px;border-radius:999px;font-weight:500;">Extension coming soon</span>
  </div>`;
}

// ── BOOT ──────────────────────────────────────
// Single boot flag prevents double-render from onAuthStateChange firing
// at the same time as getSession on initial page load.
let _booted = false;

(async function boot() {
  render(); // show loading spinner immediately

  // Only handle auth changes AFTER initial boot is done
  db.auth.onAuthStateChange(async (event, session) => {
    if (!_booted) return; // ignore the initial INITIAL_SESSION event
    state.session = session;
    if (!session) {
      state.data = { addresses:[], education:[], employment:[], travel:[], passports:[], ids:[], language:[] };
    } else {
      await loadData();
    }
    state.loading = false;
    render();
  });

  // Primary boot: get session once
  const { data: { session } } = await db.auth.getSession();
  state.session = session;
  if (session) await loadData();
  state.loading = false;
  _booted = true;
  render();
})();
