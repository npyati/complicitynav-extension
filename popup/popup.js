// Complicity Navigator Chrome Extension - Popup Script

const API_BASE = 'https://complicitynavigator.com';

// Track if we're in incognito mode
let isIncognito = false;

// Helper to open links respecting incognito mode
async function openLink(url) {
  if (isIncognito) {
    // In incognito: create tab in current incognito window
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.create({ url, windowId: currentTab.windowId });
  } else {
    // Regular mode: just open normally
    chrome.tabs.create({ url });
  }
}

// Default message templates
const DEFAULT_DEMAND_TEMPLATE = '.@{handle} We\'re watching. Your actions matter. Do better. See your record: {companyPageUrl}';
const DEFAULT_APPLAUD_TEMPLATE = '.@{handle} Thank you for taking a stand. We see you and we support you. {companyPageUrl}';

// DOM Elements
const loadingEl = document.getElementById('loading');
const entityViewEl = document.getElementById('entity-view');
const noEntityViewEl = document.getElementById('no-entity-view');
const homeViewEl = document.getElementById('home-view');
const dividerEl = document.getElementById('divider');
const submitSectionEl = document.getElementById('submit-section');

// Entity view elements
const entityLogoEl = document.getElementById('entity-logo');
const entityInitialEl = document.getElementById('entity-initial');
const entityNameEl = document.getElementById('entity-name');
const entityIndustryEl = document.getElementById('entity-industry');
const complicityCountEl = document.getElementById('complicity-count');
const courageCountEl = document.getElementById('courage-count');
const viewProfileLinkEl = document.getElementById('view-profile-link');
const issuesSectionEl = document.getElementById('issues-section');
const issuesListEl = document.getElementById('issues-list');

// Suggest form elements
const suggestSectionEl = document.getElementById('suggest-section');
const toggleSuggestBtn = document.getElementById('toggle-suggest');
const suggestFormEl = document.getElementById('suggest-form');
const sourceUrlEl = document.getElementById('source-url');
const suggestionEl = document.getElementById('suggestion');
const suggestBtn = document.getElementById('suggest-btn');
const suggestSuccessEl = document.getElementById('suggest-success');
const suggestErrorEl = document.getElementById('suggest-error');
const retryBtn = document.getElementById('retry-btn');

// Current tab info
let currentTabInfo = null;

// Initialize popup
async function init() {
  try {
    // Check if we're in incognito mode
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    isIncognito = currentTab?.incognito || false;

    // Get current tab info from background script
    currentTabInfo = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_INFO' }, resolve);
    });

    hideLoading();

    // Check if on CN site
    const domain = currentTabInfo.domain || '';
    const isOnCNSite = domain === 'complicitynavigator.com';

    if (isOnCNSite) {
      showHomeView();
    } else if (currentTabInfo.entity) {
      showEntityView(currentTabInfo.entity);
      showSuggestSection();
    } else {
      showNoEntityView();
      showSuggestSection();
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    hideLoading();
    showNoEntityView();
  }
}

function hideLoading() {
  loadingEl.classList.add('hidden');
}

function showEntityView(entity) {
  entityViewEl.classList.remove('hidden');

  // Set entity info
  entityNameEl.textContent = entity.name;
  entityIndustryEl.textContent = entity.industry || '';

  // Set logo or initial
  if (entity.logoUrl) {
    entityLogoEl.src = entity.logoUrl;
    entityLogoEl.classList.remove('hidden');
    entityInitialEl.classList.add('hidden');
  } else {
    entityLogoEl.classList.add('hidden');
    entityInitialEl.classList.remove('hidden');
    entityInitialEl.textContent = entity.name.charAt(0).toUpperCase();
  }

  // Set tally counts
  const tally = entity.actionTally || {};
  const complicityTotal = (tally.complicity?.high || 0) + (tally.complicity?.medium || 0) + (tally.complicity?.low || 0);
  const courageTotal = (tally.resistance?.high || 0) + (tally.resistance?.medium || 0) + (tally.resistance?.low || 0);

  complicityCountEl.querySelector('.tally-number').textContent = complicityTotal;
  courageCountEl.querySelector('.tally-number').textContent = courageTotal;

  // Set profile links on tally items and button
  const entityUrl = `${API_BASE}/entity/${entity.id}`;

  // Use click handlers to respect incognito mode
  const handleEntityLinkClick = (e) => {
    e.preventDefault();
    openLink(entityUrl);
  };

  complicityCountEl.href = entityUrl;
  complicityCountEl.addEventListener('click', handleEntityLinkClick);

  courageCountEl.href = entityUrl;
  courageCountEl.addEventListener('click', handleEntityLinkClick);

  viewProfileLinkEl.href = entityUrl;
  viewProfileLinkEl.addEventListener('click', handleEntityLinkClick);

  // Show issue campaigns if available
  if (entity.issueCampaigns && entity.issueCampaigns.length > 0) {
    showIssueCampaigns(entity);
  }
}

// Generate X message from template
function generateXMessage(messageType, entity, issue) {
  const template = messageType === 'demand'
    ? (issue.demandMessageTemplate || DEFAULT_DEMAND_TEMPLATE)
    : (issue.applaudMessageTemplate || DEFAULT_APPLAUD_TEMPLATE);

  // Get handle (without @) or company name
  const handle = entity.xHandle
    ? (entity.xHandle.startsWith('@') ? entity.xHandle.slice(1) : entity.xHandle)
    : entity.name;

  const companyPageUrl = `${API_BASE}/entity/${entity.id}`;
  const issuePageUrl = `${API_BASE}/issues/${issue.slug}`;

  return template
    .replace(/{handle}/g, handle)
    .replace(/{companyPageUrl}/g, companyPageUrl)
    .replace(/{issuePageUrl}/g, issuePageUrl)
    .replace(/{companyName}/g, entity.name);
}

// Generate X intent URL
function generateXIntentUrl(message) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
}

// X icon SVG
const xIconSvg = '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

// Show issue campaigns section
function showIssueCampaigns(entity) {
  issuesSectionEl.classList.remove('hidden');
  issuesListEl.innerHTML = '';

  entity.issueCampaigns.forEach(issue => {
    const issueItem = document.createElement('div');
    issueItem.className = 'issue-item';

    // Determine stance label and button type
    let stanceLabel = '';
    let stanceClass = '';
    let buttonType = '';
    let buttonLabel = '';

    switch (issue.stance) {
      case 'COURAGE':
        stanceLabel = 'Showed Courage';
        stanceClass = 'courage';
        buttonType = 'applaud';
        buttonLabel = 'Applaud';
        break;
      case 'COMPLICITY':
        stanceLabel = 'Complicit';
        stanceClass = 'complicity';
        buttonType = 'demand';
        buttonLabel = 'Demand';
        break;
      default:
        stanceLabel = 'No Info';
        stanceClass = 'no-info';
        buttonType = 'demand';
        buttonLabel = 'Demand';
    }

    // Create info section as a link to the issue page
    const issueUrl = `${API_BASE}/issues/${issue.slug}`;
    const infoLink = document.createElement('a');
    infoLink.className = 'issue-info';
    infoLink.href = issueUrl;
    infoLink.innerHTML = `
      <div class="issue-title" title="${issue.title}">${issue.title}</div>
      <div class="issue-stance ${stanceClass}">${stanceLabel}</div>
    `;
    infoLink.addEventListener('click', (e) => {
      e.preventDefault();
      openLink(issueUrl);
    });

    // Create action button for X/Twitter
    const message = generateXMessage(buttonType, entity, issue);
    const xUrl = generateXIntentUrl(message);
    const actionBtn = document.createElement('a');
    actionBtn.className = `issue-action-btn ${buttonType}`;
    actionBtn.href = xUrl;
    actionBtn.innerHTML = `${xIconSvg} ${buttonLabel}`;
    actionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openLink(xUrl);
    });

    issueItem.appendChild(infoLink);
    issueItem.appendChild(actionBtn);
    issuesListEl.appendChild(issueItem);
  });
}

function showNoEntityView() {
  noEntityViewEl.classList.remove('hidden');
}

function showHomeView() {
  homeViewEl.classList.remove('hidden');
}

function showSuggestSection() {
  dividerEl.classList.remove('hidden');
  suggestSectionEl.classList.remove('hidden');

  // Set source URL
  if (currentTabInfo?.url) {
    const displayUrl = currentTabInfo.url.length > 45
      ? currentTabInfo.url.substring(0, 45) + '...'
      : currentTabInfo.url;
    sourceUrlEl.textContent = displayUrl;
    sourceUrlEl.title = currentTabInfo.url;
  }
}

// Toggle suggest form visibility
toggleSuggestBtn.addEventListener('click', () => {
  const isVisible = !suggestFormEl.classList.contains('hidden');

  if (isVisible) {
    suggestFormEl.classList.add('hidden');
    toggleSuggestBtn.classList.remove('active');
  } else {
    suggestFormEl.classList.remove('hidden');
    suggestSuccessEl.classList.add('hidden');
    suggestErrorEl.classList.add('hidden');
    toggleSuggestBtn.classList.add('active');
    // Scroll to show the form
    setTimeout(() => {
      suggestFormEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  }
});

// Handle form submission
suggestFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = suggestionEl.value.trim();
  if (!message) return;

  suggestBtn.disabled = true;
  suggestBtn.textContent = 'Sending...';

  const data = {
    sourceUrl: currentTabInfo?.url || '',
    sourceTitle: currentTabInfo?.title || '',
    domain: currentTabInfo?.domain || '',
    message: message,
    entityId: currentTabInfo?.entity?.id || null,
    entityName: currentTabInfo?.entity?.name || null,
  };

  try {
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SUBMIT_SUGGESTION', data }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to send'));
        }
      });
    });

    // Show success
    suggestFormEl.classList.add('hidden');
    suggestSuccessEl.classList.remove('hidden');

    // Reset form
    suggestionEl.value = '';

  } catch (error) {
    console.error('Suggestion error:', error);
    suggestErrorEl.querySelector('.error-text').textContent = error.message || 'Failed to send. Please try again.';
    suggestErrorEl.classList.remove('hidden');
  } finally {
    suggestBtn.disabled = false;
    suggestBtn.textContent = 'Send';
  }
});

// Retry button
retryBtn.addEventListener('click', () => {
  suggestErrorEl.classList.add('hidden');
  suggestFormEl.classList.remove('hidden');
});

// Initialize on load
init();
