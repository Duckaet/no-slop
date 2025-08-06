// Popup script for AI Content Blocker
// Handles popup UI interactions and settings management

class PopupController {
  constructor() {
    this.settings = null;
    this.stats = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
    
    // Set up periodic stats refresh
    this.startStatsRefresh();
  }

  startStatsRefresh() {
    // Refresh stats every 2 seconds while popup is open
    this.statsInterval = setInterval(async () => {
      const statsResponse = await this.sendMessage({ type: 'GET_STATS' });
      const newStats = statsResponse.stats || { tweetsScanned: 0, tweetsBlocked: 0 };
      
      // Only update if stats changed
      if (newStats.tweetsScanned !== this.stats.tweetsScanned || 
          newStats.tweetsBlocked !== this.stats.tweetsBlocked) {
        this.stats = newStats;
        this.updateStats();
      }
    }, 2000);
    
    // Clear interval when popup is closed
    window.addEventListener('beforeunload', () => {
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }
    });
  }

  async loadData() {
    // Load settings and stats
    const [settingsResponse, statsResponse] = await Promise.all([
      this.sendMessage({ type: 'GET_SETTINGS' }),
      this.sendMessage({ type: 'GET_STATS' })
    ]);

    this.settings = settingsResponse.settings || this.getDefaultSettings();
    this.stats = statsResponse.stats || { tweetsScanned: 0, tweetsBlocked: 0 };
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  getDefaultSettings() {
    return {
      enabled: true,
      mode: 'block',
      threshold: 0.7,
      whitelistedAccounts: []
    };
  }

  setupEventListeners() {
    // Extension enabled/disabled toggle
    const enabledToggle = document.getElementById('enabledToggle');
    enabledToggle.checked = this.settings.enabled;
    enabledToggle.addEventListener('change', (e) => {
      this.settings.enabled = e.target.checked;
      this.saveSettings();
      this.updateUI();
    });

    // Mode selection (Block vs Flag)
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.settings.mode = mode;
        this.saveSettings();
        this.updateModeButtons();
        this.updateModeDescription();
      });
    });

    // Threshold slider
    const thresholdSlider = document.getElementById('thresholdSlider');
    thresholdSlider.value = this.settings.threshold;
    thresholdSlider.addEventListener('input', (e) => {
      this.settings.threshold = parseFloat(e.target.value);
      this.updateThresholdDisplay();
    });

    thresholdSlider.addEventListener('change', () => {
      this.saveSettings();
    });

    // Options button
    const optionsBtn = document.getElementById('optionsBtn');
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async saveSettings() {
    await chrome.storage.sync.set({ settings: this.settings });
  }

  updateUI() {
    this.updateStats();
    this.updateModeButtons();
    this.updateModeDescription();
    this.updateThresholdDisplay();
    this.updateEnabledState();
  }

  updateStats() {
    const scannedElement = document.getElementById('scannedCount');
    const blockedElement = document.getElementById('blockedCount');
    const percentageElement = document.getElementById('blockPercentage');

    const scanned = this.stats.tweetsScanned || 0;
    const blocked = this.stats.tweetsBlocked || 0;
    const percentage = scanned > 0 ? ((blocked / scanned) * 100).toFixed(1) : 0;

    scannedElement.textContent = this.formatNumber(scanned);
    blockedElement.textContent = this.formatNumber(blocked);
    percentageElement.textContent = `${percentage}%`;

    // Update accessibility
    scannedElement.setAttribute('aria-label', `${scanned} tweets scanned today`);
    blockedElement.setAttribute('aria-label', `${blocked} AI content items blocked today`);
    percentageElement.setAttribute('aria-label', `${percentage} percent block rate`);
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  updateModeButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
      const isActive = btn.dataset.mode === this.settings.mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive.toString());
    });
  }

  updateModeDescription() {
    const modeDescription = document.getElementById('modeDescription');
    const descriptions = {
      block: 'Hide AI-generated content completely',
      flag: 'Show AI content with a warning label'
    };
    modeDescription.textContent = descriptions[this.settings.mode] || descriptions.block;
  }

  updateThresholdDisplay() {
    const thresholdValue = document.getElementById('thresholdValue');
    const percentage = Math.round(this.settings.threshold * 100);
    thresholdValue.textContent = `${percentage}%`;
    
    // Update slider value if it's different
    const slider = document.getElementById('thresholdSlider');
    if (Math.abs(parseFloat(slider.value) - this.settings.threshold) > 0.01) {
      slider.value = this.settings.threshold;
    }
  }

  updateEnabledState() {
    const mainContent = document.querySelector('.popup-main');
    const enabledToggle = document.getElementById('enabledToggle');
    
    if (this.settings.enabled) {
      mainContent.style.opacity = '1';
      mainContent.style.pointerEvents = 'auto';
    } else {
      mainContent.style.opacity = '0.5';
      mainContent.style.pointerEvents = 'none';
    }
    
    enabledToggle.checked = this.settings.enabled;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Refresh stats when popup is opened
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Popup became visible, refresh data
    setTimeout(() => {
      if (window.popupController) {
        window.popupController.loadData().then(() => {
          window.popupController.updateStats();
        });
      }
    }, 100);
  }
});

// Handle keyboard navigation
document.addEventListener('keydown', (e) => {
  // Close popup on Escape
  if (e.key === 'Escape') {
    window.close();
  }
  
  // Navigate mode buttons with arrow keys
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const activeButton = document.querySelector('.mode-btn.active');
    if (activeButton) {
      const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
      const currentIndex = modeButtons.indexOf(activeButton);
      const nextIndex = e.key === 'ArrowRight' 
        ? (currentIndex + 1) % modeButtons.length
        : (currentIndex - 1 + modeButtons.length) % modeButtons.length;
      
      modeButtons[nextIndex].click();
      modeButtons[nextIndex].focus();
      e.preventDefault();
    }
  }
});
