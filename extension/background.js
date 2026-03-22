// ─────────────────────────────────────────────
//  Visa Buddy — Background Service Worker
//  Syncs profile data from Supabase to local
//  extension storage so popup can use it offline
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Sync profile from Supabase using a stored token
async function syncFromSupabase(accessToken, userId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/visa_buddy_profiles?user_id=eq.${userId}&select=data`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.data || null;
  } catch (err) {
    console.error('Visa Buddy sync error:', err);
    return null;
  }
}

// Listen for messages from the web app to store the token + profile
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'VISA_BUDDY_SYNC') {
    const { accessToken, userId, profile } = message;

    // Store token and profile in extension local storage
    chrome.storage.local.set({
      visaBuddyToken: accessToken,
      visaBuddyUserId: userId,
      visaBuddyProfile: { ...profile, _email: message.email }
    }, () => {
      sendResponse({ success: true });
    });
  }

  if (message.type === 'VISA_BUDDY_LOGOUT') {
    chrome.storage.local.remove(['visaBuddyToken', 'visaBuddyUserId', 'visaBuddyProfile'], () => {
      sendResponse({ success: true });
    });
  }

  return true; // keep message channel open for async response
});

// Periodic background sync (every 30 minutes)
chrome.alarms.create('visa-buddy-sync', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'visa-buddy-sync') return;

  chrome.storage.local.get(['visaBuddyToken', 'visaBuddyUserId'], async result => {
    const { visaBuddyToken, visaBuddyUserId } = result;
    if (!visaBuddyToken || !visaBuddyUserId) return;

    const data = await syncFromSupabase(visaBuddyToken, visaBuddyUserId);
    if (data) {
      chrome.storage.local.get(['visaBuddyProfile'], r => {
        chrome.storage.local.set({
          visaBuddyProfile: { ...data, _email: r.visaBuddyProfile?._email }
        });
      });
    }
  });
});
