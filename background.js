// Complicity Navigator Chrome Extension - Background Service Worker

const API_BASE = 'https://complicitynavigator.com';

// Cache for entity lookups (domain -> entity data)
const entityCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Extract root domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    return hostname;
  } catch {
    return null;
  }
}

// Fetch entity by domain from CN API
async function fetchEntityByDomain(domain) {
  // Check cache first
  const cached = entityCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `${API_BASE}/api/extension/lookup?domain=${encodeURIComponent(domain)}`;
    console.log('[CN Extension] Fetching:', url);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        // Cache null result to avoid repeated lookups
        console.log('[CN Extension] No entity found for domain:', domain);
        entityCache.set(domain, { data: null, timestamp: Date.now() });
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const entity = await response.json();
    console.log('[CN Extension] Found entity:', entity.name);
    entityCache.set(domain, { data: entity, timestamp: Date.now() });
    return entity;
  } catch (error) {
    console.error('[CN Extension] Error fetching entity:', error);
    return null;
  }
}

// Update badge based on entity data
function updateBadge(tabId, entity) {
  if (!entity) {
    // No entity found - show question mark or clear
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'Complicity Navigator' });
    return;
  }

  // Determine badge based on entity's action tally
  const tally = entity.actionTally || {};
  const complicityCount = (tally.complicity?.high || 0) + (tally.complicity?.medium || 0) + (tally.complicity?.low || 0);
  const resistanceCount = (tally.resistance?.high || 0) + (tally.resistance?.medium || 0) + (tally.resistance?.low || 0);

  let badgeText = '';
  let badgeColor = '#666666'; // Gray default
  let title = `${entity.name} - Complicity Navigator`;

  if (complicityCount > 0 && resistanceCount === 0) {
    // Only complicity acts
    badgeText = complicityCount.toString();
    badgeColor = '#FF1744'; // Red
    title = `${entity.name} - ${complicityCount} act${complicityCount > 1 ? 's' : ''} of complicity`;
  } else if (resistanceCount > 0 && complicityCount === 0) {
    // Only resistance acts
    badgeText = resistanceCount.toString();
    badgeColor = '#00C853'; // Green
    title = `${entity.name} - ${resistanceCount} act${resistanceCount > 1 ? 's' : ''} of courage`;
  } else if (complicityCount > 0 && resistanceCount > 0) {
    // Mixed actions
    badgeText = (complicityCount + resistanceCount).toString();
    badgeColor = '#FF9800'; // Orange
    title = `${entity.name} - ${complicityCount} complicity, ${resistanceCount} courage`;
  } else {
    // Entity exists but no actions
    badgeText = '?';
    badgeColor = '#666666';
    title = `${entity.name} - No acts recorded`;
  }

  chrome.action.setBadgeText({ tabId, text: badgeText });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor });
  chrome.action.setTitle({ tabId, title });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page load completes and we have a URL
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip chrome:// and other internal URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      updateBadge(tabId, null);
      return;
    }

    const domain = extractDomain(tab.url);
    console.log('[CN Extension] Tab updated:', domain);

    if (!domain) {
      updateBadge(tabId, null);
      return;
    }

    const entity = await fetchEntityByDomain(domain);
    console.log('[CN Extension] Entity lookup for', domain, '->', entity ? entity.name : 'not found');
    updateBadge(tabId, entity);

    // Store current tab's entity info for popup
    if (entity) {
      chrome.storage.local.set({ [`tab_${tabId}`]: entity });
    } else {
      chrome.storage.local.remove(`tab_${tabId}`);
    }
  }
});

// Handle tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  if (tab.url) {
    const domain = extractDomain(tab.url);

    if (!domain) {
      updateBadge(activeInfo.tabId, null);
      return;
    }

    const entity = await fetchEntityByDomain(domain);
    updateBadge(activeInfo.tabId, entity);

    if (entity) {
      chrome.storage.local.set({ [`tab_${activeInfo.tabId}`]: entity });
    } else {
      chrome.storage.local.remove(`tab_${activeInfo.tabId}`);
    }
  }
});

// Clean up storage when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CURRENT_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const tab = tabs[0];
        const domain = extractDomain(tab.url);
        const entity = domain ? await fetchEntityByDomain(domain) : null;

        sendResponse({
          url: tab.url,
          title: tab.title,
          domain: domain,
          entity: entity
        });
      } else {
        sendResponse({ url: null, title: null, domain: null, entity: null });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.type === 'SUBMIT_SUGGESTION') {
    submitSuggestion(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Submit suggestion to CN API
async function submitSuggestion(data) {
  try {
    const response = await fetch(`${API_BASE}/api/extension/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Failed to send: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error submitting suggestion:', error);
    throw error;
  }
}
