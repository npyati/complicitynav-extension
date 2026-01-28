# Complicity Navigator Chrome Extension

A Chrome extension that surfaces Complicity Navigator data while browsing and enables low-friction event submissions.

## Features

### Organization Detection
- Automatically detects when you visit a website belonging to a tracked organization
- Shows badge indicator with complicity (red) or courage (green) counts
- Click the extension icon to see full entity details and link to CN profile

### Event Submission
- Submit events directly from any webpage
- Auto-captures source URL, title, and domain
- Submissions go to the CN admin review queue

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `chrome-extension` folder
5. The extension should now appear in your toolbar

## Files

```
chrome-extension/
├── manifest.json      # Extension configuration (Manifest V3)
├── background.js      # Service worker for domain detection
├── icons/             # Extension icons (16, 32, 48, 128px)
├── popup/
│   ├── popup.html     # Popup UI structure
│   ├── popup.css      # Popup styles
│   └── popup.js       # Popup functionality
└── README.md
```

## API Endpoints

The extension communicates with these CN API endpoints:

- `GET /api/extension/lookup?domain=example.com` - Lookup entity by domain
- `POST /api/extension/submit` - Submit event from extension

## Development

To test locally:

1. Update `API_BASE` in `background.js` and `popup/popup.js` to `http://localhost:3000`
2. Run the CN development server (`npm run dev` in the complicity folder)
3. Load the extension in Chrome
4. Visit a website with a tracked entity (e.g., if you have Meta tracked, visit meta.com)

## Publishing to Chrome Web Store

1. Create a ZIP of the extension folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay one-time $5 developer fee (if not already done)
4. Upload the ZIP and fill in store listing details
5. Submit for review

## Notes

- Extension uses Manifest V3 (required by Chrome)
- No bundler/framework - vanilla JS for simplicity
- Entity matching requires the entity to have a website URL set in the database
