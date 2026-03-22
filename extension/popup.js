// ─────────────────────────────────────────────
//  Visa Buddy — Extension Popup
// ─────────────────────────────────────────────

const WEBAPP_URL = 'https://visabuddy-sable.vercel.app/';

const body = document.getElementById('popup-body');

function render(profile, detectedFields) {
  if (!profile) {
    body.innerHTML = `
      <div class="not-linked">
        <p>Connect your Visa Buddy account to autofill immigration forms on this page.</p>
        <button class="open-webapp" id="open-webapp">Open Visa Buddy →</button>
      </div>`;
    document.getElementById('open-webapp').addEventListener('click', () => {
      chrome.tabs.create({ url: WEBAPP_URL });
    });
    return;
  }

  const hasAddresses = (profile.addresses || []).length > 0;
  const hasEmployment = (profile.employment || []).length > 0;
  const hasPassports = (profile.passports || []).length > 0;
  const hasTravel = (profile.travel || []).length > 0;
  const hasLanguage = (profile.language || []).length > 0;

  body.innerHTML = `
    <div id="status-msg" class="status" style="min-height:18px"></div>

    <div class="section-title">Personal info</div>
    <button class="fill-btn" data-action="fill-address" ${!hasAddresses ? 'disabled' : ''}>
      Fill address fields
      <span class="field-count">${(profile.addresses || []).length} saved</span>
    </button>

    <div class="section-title">Background</div>
    <button class="fill-btn" data-action="fill-employment" ${!hasEmployment ? 'disabled' : ''}>
      Fill employment history
      <span class="field-count">${(profile.employment || []).length} jobs</span>
    </button>

    <div class="section-title">Travel &amp; documents</div>
    <button class="fill-btn" data-action="fill-passports" ${!hasPassports ? 'disabled' : ''}>
      Fill passport details
      <span class="field-count">${(profile.passports || []).length} docs</span>
    </button>
    <button class="fill-btn" data-action="fill-travel" ${!hasTravel ? 'disabled' : ''}>
      Fill travel history
      <span class="field-count">${(profile.travel || []).length} trips</span>
    </button>

    <div class="section-title">Language</div>
    <button class="fill-btn" data-action="fill-language" ${!hasLanguage ? 'disabled' : ''}>
      Fill language test scores
      <span class="field-count">${(profile.language || []).length} tests</span>
    </button>

    <div class="divider"></div>
    <button class="fill-btn" data-action="fill-all" style="background:#2A2318">
      Autofill everything on this page
      <span class="arrow">→</span>
    </button>

    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#9E8C70">Logged in as ${escHtml(profile._email || '')}</span>
      <button id="refresh-btn" style="font-size:11px;color:#9E8C70;background:none;border:none;cursor:pointer;text-decoration:underline;">Sync</button>
    </div>`;

  // Wire up buttons
  document.querySelectorAll('.fill-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Filling…';

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: fillFields,
          args: [profile, action]
        });

        const filled = results?.[0]?.result || 0;
        showStatus(`Filled ${filled} field${filled !== 1 ? 's' : ''}`, 'success');
      } catch (err) {
        showStatus('Could not fill — check page permissions', 'error');
      } finally {
        render(profile, detectedFields);
      }
    });
  });

  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    showStatus('Syncing…', '');
    await syncProfile();
  });
}

function showStatus(msg, type) {
  const el = document.getElementById('status-msg');
  if (el) {
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => { if (el) { el.textContent = ''; el.className = 'status'; } }, 3000);
  }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ── FIELD FILLER (injected into page) ────────
// This function runs in the context of the target tab
function fillFields(profile, action) {
  let filled = 0;

  function setField(el, value) {
    if (!el || !value) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    filled++;
  }

  // Find inputs by common name/id/placeholder patterns
  function findInput(...selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function findByLabel(text) {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find(l => l.textContent.toLowerCase().includes(text.toLowerCase()));
    if (!label) return null;
    const forId = label.getAttribute('for');
    if (forId) return document.getElementById(forId);
    return label.querySelector('input, select, textarea') || label.nextElementSibling;
  }

  // ── ADDRESS FILLING ──
  if (action === 'fill-address' || action === 'fill-all') {
    const current = (profile.addresses || []).find(a => !a.toDate) || profile.addresses?.[0];
    if (current) {
      const streetEl = findInput('[name*="street" i]', '[id*="street" i]', '[name*="address1" i]', '[id*="address1" i]') || findByLabel('street') || findByLabel('address');
      setField(streetEl, current.street);

      const cityEl = findInput('[name*="city" i]', '[id*="city" i]') || findByLabel('city');
      setField(cityEl, current.city);

      const provinceEl = findInput('[name*="province" i]', '[id*="province" i]', '[name*="state" i]') || findByLabel('province') || findByLabel('state');
      setField(provinceEl, current.province);

      const countryEl = findInput('[name*="country" i]', '[id*="country" i]') || findByLabel('country');
      setField(countryEl, current.country);

      const postalEl = findInput('[name*="postal" i]', '[id*="postal" i]', '[name*="zip" i]', '[name*="postcode" i]') || findByLabel('postal') || findByLabel('zip');
      setField(postalEl, current.postal);
    }
  }

  // ── PASSPORT FILLING ──
  if (action === 'fill-passports' || action === 'fill-all') {
    const passport = (profile.passports || []).find(p => p.docType === 'passport' && new Date(p.expiryDate) > new Date()) || profile.passports?.[0];
    if (passport) {
      const numEl = findInput('[name*="passport" i]', '[id*="passport" i]', '[name*="document_number" i]') || findByLabel('passport number') || findByLabel('document number');
      setField(numEl, passport.number);

      const countryEl = findInput('[name*="issuing" i]', '[id*="issuing" i]') || findByLabel('issuing country') || findByLabel('country of issue');
      setField(countryEl, passport.country);

      const expiryEl = findInput('[name*="expir" i]', '[id*="expir" i]') || findByLabel('expiry') || findByLabel('expiration');
      setField(expiryEl, passport.expiryDate);
    }
  }

  // ── EMPLOYMENT FILLING ──
  if (action === 'fill-employment' || action === 'fill-all') {
    const current = (profile.employment || []).find(e => !e.toDate) || profile.employment?.[0];
    if (current) {
      const employerEl = findInput('[name*="employer" i]', '[id*="employer" i]', '[name*="company" i]') || findByLabel('employer') || findByLabel('company');
      setField(employerEl, current.employer);

      const titleEl = findInput('[name*="title" i]', '[id*="title" i]', '[name*="occupation" i]') || findByLabel('job title') || findByLabel('occupation') || findByLabel('position');
      setField(titleEl, current.title);
    }
  }

  // ── LANGUAGE FILLING ──
  if (action === 'fill-language' || action === 'fill-all') {
    const latest = (profile.language || []).sort((a, b) => new Date(b.testDate) - new Date(a.testDate))[0];
    if (latest) {
      const testEl = findInput('[name*="language_test" i]', '[id*="language_test" i]', '[name*="test_type" i]') || findByLabel('language test') || findByLabel('test type');
      setField(testEl, latest.testType);

      const scoreEl = findInput('[name*="score" i]', '[id*="score" i]') || findByLabel('score') || findByLabel('overall');
      setField(scoreEl, latest.score);
    }
  }

  return filled;
}

// ── SYNC PROFILE FROM STORAGE ─────────────────
async function syncProfile() {
  return new Promise(resolve => {
    chrome.storage.local.get(['visaBuddyProfile'], result => {
      resolve(result.visaBuddyProfile || null);
    });
  });
}

// ── BOOT ─────────────────────────────────────
(async function boot() {
  body.innerHTML = `<div class="status">Loading profile…</div>`;
  const profile = await syncProfile();
  render(profile);
})();
