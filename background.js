// Background service worker for AI Content Blocker
// Handles extension lifecycle, settings management, and updates

class BackgroundService {
  constructor() {
    this.stats = {
      tweetsScanned: 0,
      tweetsBlocked: 0,
      lastReset: Date.now()
    };
    
    this.initializeExtension();
  }

  async initializeExtension() {
    // Set default settings on installation
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        await this.setDefaultSettings();
        console.log('AI Content Blocker installed');
      }
    });

    // Load existing stats
    const storedStats = await chrome.storage.local.get(['stats']);
    if (storedStats.stats) {
      this.stats = { ...this.stats, ...storedStats.stats };
    }
  }

  async setDefaultSettings() {
    const defaultSettings = {
      enabled: true,
      mode: 'block', // 'block' or 'flag'
      threshold: 0.7, // Confidence threshold (0-1)
      showStats: true,
      whitelistedAccounts: [],
      customRules: [],
      telemetryEnabled: false
    };

    await chrome.storage.sync.set({ settings: defaultSettings });
    await chrome.storage.local.set({ stats: this.stats });
  }

  async updateStats(scanned, blocked) {
    this.stats.tweetsScanned += scanned;
    this.stats.tweetsBlocked += blocked;
    
    // Reset daily stats
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - this.stats.lastReset > dayInMs) {
      this.stats.tweetsScanned = scanned;
      this.stats.tweetsBlocked = blocked;
      this.stats.lastReset = now;
    }

    await chrome.storage.local.set({ stats: this.stats });
  }

  async getStats() {
    return this.stats;
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Message handling for communication with content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'UPDATE_STATS':
      backgroundService.updateStats(request.scanned, request.blocked);
      sendResponse({ success: true });
      break;
      
    case 'GET_STATS':
      backgroundService.getStats().then(stats => {
        sendResponse({ stats });
      });
      return true; // Keep message channel open for async response
      
    case 'GET_SETTINGS':
      chrome.storage.sync.get(['settings']).then(result => {
        sendResponse({ settings: result.settings });
      });
      return true;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Tab update listener for injecting content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
    // Content script should already be injected via manifest
    console.log('X/Twitter page loaded:', tab.url);
  }
});
