/**
 * Arena Leaderboard & Item Tracker
 * High-performance, mobile-first Royal Purple gaming interface with sound effects,
 * celebration confetti, direct score editor, and rock-solid local state.
 */

const LOCAL_STORAGE_KEY = 'arena_scoreboard_permanent_v1';
const ADMIN_SESSION_KEY = 'arena_admin_session';
const SOUND_PREF_KEY = 'arena_sound_enabled';

// Lightweight Synthesized Web Audio Engine (Zero external audio files needed)
class SoundFX {
  constructor() {
    this.enabled = localStorage.getItem(SOUND_PREF_KEY) !== 'false';
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(SOUND_PREF_KEY, this.enabled ? 'true' : 'false');
    if (this.enabled) this.playCoin();
    return this.enabled;
  }

  playCoin() {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.28);
    } catch (e) {}
  }

  playTap() {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }

  playCelebration() {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.07);
        osc.stop(this.ctx.currentTime + idx * 0.07 + 0.25);
      });
    } catch (e) {}
  }
}

// Lightweight Confetti Particle Burst
class ConfettiEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.animating = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(x = window.innerWidth / 2, y = window.innerHeight * 0.35) {
    if (!this.canvas || !this.ctx) return;
    const colors = ['#ff2d87', '#ffc700', '#a855f7', '#38bdf8', '#34d399', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1,
        gravity: 0.25
      });
    }

    if (!this.animating) {
      this.animating = true;
      this.loop();
    }
  }

  loop() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.015;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0 && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.loop());
    } else {
      this.animating = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

class ArenaTrackerApp {
  constructor() {
    this.players = this.loadLocalPlayers();
    this.publishedPlayers = this.loadPublishedPlayers();
    if (this.publishedPlayers.length === 0 && this.players.length > 0) {
      this.publishedPlayers = JSON.parse(JSON.stringify(this.players));
    }
    this.searchQuery = '';
    this.currentPage = 'leaderboard';
    this.isAdmin = Boolean(localStorage.getItem(ADMIN_SESSION_KEY));
    this.isOnlineHttp = window.location.protocol.startsWith('http');
    this.pollTimer = null;
    this.previousLeader = null;

    this.sound = new SoundFX();
    this.confetti = new ConfettiEngine(document.getElementById('confetti-canvas'));

    this.initElements();
    this.initDialogs();
    this.initEvents();
    this.handleRoute();

    // Initial render
    this.render();

    // Background sync only if served over HTTP/HTTPS
    if (this.isOnlineHttp) {
      this.syncFromAPI();
      this.startPolling();
    }
  }

  // Sanitize and strictly deduplicate players by case-insensitive name
  cleanPlayers(list) {
    if (!Array.isArray(list)) return [];
    const map = new Map();
    for (const p of list) {
      if (!p || !p.name) continue;
      const name = String(p.name).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const count = Math.max(0, Number(p.count) || 0);

      if (map.has(key)) {
        const existing = map.get(key);
        // Retain highest count
        if (count > existing.count) {
          existing.count = count;
        }
        if (p.id && (!existing.id || existing.id.startsWith('temp_'))) {
          existing.id = p.id;
        }
      } else {
        map.set(key, {
          id: p.id || ('p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
          name,
          count,
          createdAt: Number(p.createdAt) || Date.now()
        });
      }
    }
    return Array.from(map.values());
  }

  loadPublishedPlayers() {
    try {
      const data = localStorage.getItem('arena_published_players_v1');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return this.cleanPlayers(parsed);
      }
    } catch (e) {}
    return [];
  }

  savePublishedPlayers() {
    try {
      this.publishedPlayers = this.cleanPlayers(this.publishedPlayers);
      localStorage.setItem('arena_published_players_v1', JSON.stringify(this.publishedPlayers));
    } catch (e) {}
  }

  loadLocalPlayers() {
    try {
      // 1. Check primary permanent storage
      const primaryData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (primaryData) {
        const parsed = JSON.parse(primaryData);
        if (Array.isArray(parsed) && parsed.length > 0) return this.cleanPlayers(parsed);
      }

      // 2. Safe Migration: Check if user had added players in any previous prototype keys
      const candidateKeys = [
        'arena_tracker_players_v1',
        'item_tracker_people_v3',
        'item_tracker_people_v2',
        'item_tracker_people_v1'
      ];

      for (const k of candidateKeys) {
        const legacy = localStorage.getItem(k);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = this.cleanPlayers(parsed);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
            return cleaned;
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
    return [];
  }

  saveLocalPlayers() {
    try {
      this.players = this.cleanPlayers(this.players);
      const dataStr = JSON.stringify(this.players);
      localStorage.setItem(LOCAL_STORAGE_KEY, dataStr);
      localStorage.setItem('arena_tracker_players_v1', dataStr); // Dual backup
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  initElements() {
    // Nav tabs & Header
    this.tabLeaderboard = document.getElementById('tab-leaderboard');
    this.tabTracker = document.getElementById('tab-tracker');
    this.pageLeaderboard = document.getElementById('page-leaderboard');
    this.pageTracker = document.getElementById('page-tracker');
    this.navPeopleCount = document.getElementById('nav-people-count');
    this.headerTotalItems = document.getElementById('header-total-items');
    this.pageDynamicTitle = document.getElementById('page-dynamic-title');
    this.goToTrackerBtn = document.getElementById('go-to-tracker-btn');

    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.soundIcon = document.getElementById('sound-icon');
    this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';

    // Admin & Mode Elements
    this.modeBadge = document.getElementById('mode-badge');
    this.modeText = document.getElementById('mode-text');
    this.btnAdminAuth = document.getElementById('btn-admin-auth');
    this.adminIconState = document.getElementById('admin-icon-state');
    this.adminQuickActions = document.getElementById('admin-quick-actions');
    this.btnPublishLeaderboard = document.getElementById('btn-publish-leaderboard');
    this.btnResetAll = document.getElementById('btn-reset-all');

    // Admin Dialog Elements
    this.adminDialog = document.getElementById('admin-dialog');
    this.adminAuthForm = document.getElementById('admin-auth-form');
    this.adminPasswordInput = document.getElementById('admin-password-input');
    this.adminAuthError = document.getElementById('admin-auth-error');
    this.btnCloseDialog = document.getElementById('btn-close-dialog');
    this.btnCancelDialog = document.getElementById('btn-cancel-dialog');

    // Edit Score Dialog Elements
    this.editScoreDialog = document.getElementById('edit-score-dialog');
    this.editScoreForm = document.getElementById('edit-score-form');
    this.editScoreTitle = document.getElementById('edit-score-title');
    this.editScoreSubtitle = document.getElementById('edit-score-subtitle');
    this.editPlayerId = document.getElementById('edit-player-id');
    this.editScoreInput = document.getElementById('edit-score-input');
    this.editScoreError = document.getElementById('edit-score-error');
    this.btnCloseEditDialog = document.getElementById('btn-close-edit-dialog');
    this.btnCancelEditDialog = document.getElementById('btn-cancel-edit-dialog');

    // Page 1 Tracker Elements
    this.viewerBanner = document.getElementById('viewer-info-banner');
    this.adminAddCard = document.getElementById('admin-add-card');
    this.addPersonForm = document.getElementById('add-person-form');
    this.personNameInput = document.getElementById('person-name-input');
    this.personCountInput = document.getElementById('person-count-input');
    this.formErrorMsg = document.getElementById('form-error-msg');
    this.peopleList = document.getElementById('people-list');
    this.filterInput = document.getElementById('filter-input');
    this.clearSearchBtn = document.getElementById('clear-search-btn');
    this.emptyState = document.getElementById('empty-state');
    this.noSearchResults = document.getElementById('no-search-results');
    this.listInstructionsText = document.getElementById('list-instructions-text');
    this.emptyDescText = document.getElementById('empty-desc-text');

    // Stats Elements
    this.statTotalPeople = document.getElementById('stat-total-people');
    this.statTotalItems = document.getElementById('stat-total-items');
    this.statCurrentLeader = document.getElementById('stat-current-leader');

    // Page 2 Leaderboard Elements
    this.adminLeaderboardNotice = document.getElementById('admin-leaderboard-notice');
    this.podiumShowcase = document.getElementById('podium-showcase');
    this.rankingsContainer = document.getElementById('rankings-container');
    this.restList = document.getElementById('rest-list');
    this.restCountBadge = document.getElementById('rest-count-badge');
    this.restEmptyState = document.getElementById('rest-empty-state');
    this.leaderboardEmpty = document.getElementById('leaderboard-empty');

    // Toast
    this.toastEl = document.getElementById('toast');
  }

  initDialogs() {
    const bindLightDismiss = (dialog, closeFn) => {
      if (!dialog) return;
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isIn = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );
          if (!isIn) closeFn();
        });
      }
    };

    bindLightDismiss(this.adminDialog, () => this.closeAdminModal());
    bindLightDismiss(this.editScoreDialog, () => this.closeEditScoreModal());
  }

  initEvents() {
    // Navigation Tabs
    this.tabLeaderboard.addEventListener('click', () => {
      this.sound.playTap();
      this.switchPage('leaderboard');
    });
    this.tabTracker.addEventListener('click', () => {
      this.sound.playTap();
      this.switchPage('tracker');
    });
    if (this.goToTrackerBtn) {
      this.goToTrackerBtn.addEventListener('click', () => {
        this.sound.playTap();
        this.switchPage('tracker');
      });
    }

    // Sound toggle button
    this.btnSoundToggle.addEventListener('click', () => {
      const isEnabled = this.sound.toggle();
      this.soundIcon.textContent = isEnabled ? '🔊' : '🔇';
      this.showToast(isEnabled ? 'Sound effects enabled 🔊' : 'Sound muted 🔇');
    });

    // Hash Route
    window.addEventListener('hashchange', () => this.handleRoute());

    // Admin Auth Button (Toggle)
    this.btnAdminAuth.addEventListener('click', () => {
      this.sound.playTap();
      if (this.isAdmin) {
        this.logoutAdmin();
      } else {
        this.openAdminModal();
      }
    });

    // Publish Leaderboard Button
    if (this.btnPublishLeaderboard) {
      this.btnPublishLeaderboard.addEventListener('click', () => {
        this.publishLeaderboard(false);
      });
    }

    // Reset All Scores
    if (this.btnResetAll) {
      this.btnResetAll.addEventListener('click', () => this.handleResetAllScores());
    }

    // Close Dialog Buttons
    this.btnCloseDialog.addEventListener('click', () => this.closeAdminModal());
    this.btnCancelDialog.addEventListener('click', () => this.closeAdminModal());

    this.btnCloseEditDialog.addEventListener('click', () => this.closeEditScoreModal());
    this.btnCancelEditDialog.addEventListener('click', () => this.closeEditScoreModal());

    // Admin Login Form
    this.adminAuthForm.addEventListener('submit', (e) => this.handleAdminLogin(e));
    this.adminPasswordInput.addEventListener('input', () => {
      this.adminAuthError.textContent = '';
      this.adminPasswordInput.classList.remove('is-invalid');
    });

    // Edit Score Form
    this.editScoreForm.addEventListener('submit', (e) => this.handleSaveDirectScore(e));
    this.editScoreDialog.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-shortcut');
      if (!btn) return;
      this.sound.playTap();
      const addVal = btn.dataset.add;
      const setVal = btn.dataset.set;
      let curr = parseInt(this.editScoreInput.value, 10) || 0;
      if (addVal) curr += parseInt(addVal, 10);
      if (setVal !== undefined) curr = parseInt(setVal, 10);
      this.editScoreInput.value = Math.max(0, curr);
    });

    // Add Player Submit
    this.addPersonForm.addEventListener('submit', (e) => this.handleAddPlayer(e));
    this.personNameInput.addEventListener('input', () => this.clearFormError());

    // Search filter
    this.filterInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.clearSearchBtn.hidden = !this.searchQuery;
      this.renderTrackerList();
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.sound.playTap();
      this.filterInput.value = '';
      this.searchQuery = '';
      this.clearSearchBtn.hidden = true;
      this.renderTrackerList();
      this.filterInput.focus();
    });

    // Plus, Minus, Delete, Direct Edit actions in player list
    this.peopleList.addEventListener('click', (e) => this.handleListActions(e));

    // Crown celebration on Podium
    this.podiumShowcase.addEventListener('click', (e) => {
      if (e.target.closest('.podium-floating-crown') || e.target.closest('.pillar-1')) {
        this.sound.playCelebration();
        this.confetti.burst();
      }
    });

    // Background sync on visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnlineHttp) {
        this.syncFromAPI();
      }
    });
  }

  // Route Handling
  handleRoute() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'tracker') {
      this.switchPage('tracker', false);
    } else {
      this.switchPage('leaderboard', false);
    }
  }

  switchPage(page, updateHash = true) {
    this.currentPage = page;

    if (page === 'leaderboard') {
      this.tabLeaderboard.classList.add('active');
      this.tabLeaderboard.setAttribute('aria-selected', 'true');
      this.tabTracker.classList.remove('active');
      this.tabTracker.setAttribute('aria-selected', 'false');

      this.pageLeaderboard.classList.add('active');
      this.pageTracker.classList.remove('active');
      this.pageDynamicTitle.textContent = 'Leaderboard';
      if (updateHash) window.location.hash = 'leaderboard';
    } else {
      this.tabTracker.classList.add('active');
      this.tabTracker.setAttribute('aria-selected', 'true');
      this.tabLeaderboard.classList.remove('active');
      this.tabLeaderboard.setAttribute('aria-selected', 'false');

      this.pageTracker.classList.add('active');
      this.pageLeaderboard.classList.remove('active');
      this.pageDynamicTitle.textContent = 'Item Tracker';
      if (updateHash) window.location.hash = 'tracker';
    }

    this.render();
  }

  // ==========================================================================
  // Admin Mode Controls
  // ==========================================================================

  openAdminModal() {
    this.adminPasswordInput.value = '';
    this.adminAuthError.textContent = '';
    this.adminPasswordInput.classList.remove('is-invalid');
    this.adminDialog.showModal();
    this.adminPasswordInput.focus();
  }

  closeAdminModal() {
    if (this.adminDialog && typeof this.adminDialog.close === 'function') {
      this.adminDialog.close();
    }
  }

  openEditScoreModal(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    this.editPlayerId.value = player.id;
    this.editScoreTitle.textContent = player.name;
    this.editScoreSubtitle.textContent = `Current count: ${player.count}`;
    this.editScoreInput.value = player.count;
    this.editScoreError.textContent = '';
    this.editScoreDialog.showModal();
    this.editScoreInput.focus();
    this.editScoreInput.select();
  }

  closeEditScoreModal() {
    if (this.editScoreDialog && typeof this.editScoreDialog.close === 'function') {
      this.editScoreDialog.close();
    }
  }

  handleSaveDirectScore(e) {
    e.preventDefault();
    const pid = this.editPlayerId.value;
    const player = this.players.find(p => p.id === pid);
    if (!player) return;

    const val = parseInt(this.editScoreInput.value, 10);
    if (isNaN(val) || val < 0) {
      this.editScoreError.textContent = 'Enter a valid count (0 or greater).';
      return;
    }

    player.count = val;
    this.saveLocalPlayers();
    this.sound.playCoin();
    this.closeEditScoreModal();
    this.showToast(`Updated ${player.name} to ${val} items!`, 'success');
    this.render();

    if (this.isOnlineHttp) {
      this.syncMutation('UPDATE_COUNT', { id: pid, name: player.name, setCount: val });
    }
  }

  handleResetAllScores() {
    if (!this.isAdmin) return;
    if (this.players.length === 0) {
      this.showToast('No players to reset.');
      return;
    }

    if (confirm('Reset item counts of ALL players to 0? Player names will remain.')) {
      this.players.forEach(p => (p.count = 0));
      this.saveLocalPlayers();
      this.sound.playTap();
      this.showToast('All player item counts reset to 0.');
      this.render();
      if (this.isOnlineHttp) this.syncMutation('RESET_COUNTS', {});
    }
  }

  async handleAdminLogin(e) {
    e.preventDefault();
    const entered = this.adminPasswordInput.value.trim();

    if (!entered) {
      this.adminAuthError.textContent = 'Please enter passcode.';
      this.adminPasswordInput.classList.add('is-invalid');
      return;
    }

    let authenticated = false;

    if (entered === 'manitsuttagang') {
      authenticated = true;
    } else if (this.isOnlineHttp) {
      try {
        const res = await fetch('/api/people', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${entered}`
          },
          body: JSON.stringify({ action: 'VERIFY_PASSWORD' })
        });
        if (res.ok) authenticated = true;
      } catch (err) {}
    }

    if (authenticated) {
      this.isAdmin = true;
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      this.sound.playCelebration();
      this.closeAdminModal();
      this.showToast('Unlocked Admin Mode! 👑', 'success');
      this.render();
    } else {
      this.sound.playTap();
      this.adminAuthError.textContent = 'Invalid passcode.';
      this.adminPasswordInput.classList.add('is-invalid');
    }
  }

  logoutAdmin() {
    this.isAdmin = false;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    this.publishLeaderboard(true);
    this.showToast('Exited Admin Mode. Leaderboard updated! 🏆');
    this.render();
  }

  publishLeaderboard(fromLogout = false) {
    this.publishedPlayers = this.cleanPlayers(JSON.parse(JSON.stringify(this.players)));
    this.savePublishedPlayers();
    this.sound.playCelebration();
    this.confetti.burst();
    if (!fromLogout) {
      this.showToast('Leaderboard updated with latest rankings! 🏆', 'success');
    }
    this.renderLeaderboard();
  }

  // ==========================================================================
  // Player Actions
  // ==========================================================================

  handleAddPlayer(e) {
    e.preventDefault();
    if (!this.isAdmin) {
      this.showToast('Admin access required to add players.', 'error');
      return;
    }

    const rawName = this.personNameInput.value.trim();

    if (!rawName) {
      this.showFormError('Please enter a player name.');
      this.personNameInput.focus();
      return;
    }

    if (rawName.length < 2) {
      this.showFormError('Name must be at least 2 characters.');
      this.personNameInput.focus();
      return;
    }

    const duplicate = this.players.some(p => p.name.toLowerCase() === rawName.toLowerCase());
    if (duplicate) {
      this.showFormError(`"${rawName}" is already registered.`);
      this.personNameInput.focus();
      return;
    }

    const initialCount = parseInt(this.personCountInput ? this.personCountInput.value : 0, 10) || 0;

    const newPlayer = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: rawName,
      count: Math.max(0, initialCount),
      createdAt: Date.now()
    };

    // Filter out any accidental matching entry by name before inserting
    this.players = this.players.filter(p => p.name.toLowerCase() !== rawName.toLowerCase());
    this.players.unshift(newPlayer);
    this.players = this.cleanPlayers(this.players);
    this.saveLocalPlayers();

    this.personNameInput.value = '';
    if (this.personCountInput) this.personCountInput.value = '0';
    this.clearFormError();
    this.sound.playCoin();
    this.showToast(`Added "${newPlayer.name}" (${newPlayer.count} items)`, 'success');
    this.render();

    if (this.isOnlineHttp) {
      this.syncMutation('ADD_PERSON', {
        id: newPlayer.id,
        name: newPlayer.name,
        count: newPlayer.count,
        initialCount: newPlayer.count,
        createdAt: newPlayer.createdAt
      });
    }
  }

  showFormError(msg) {
    this.formErrorMsg.textContent = msg;
    this.personNameInput.classList.add('is-invalid');
  }

  clearFormError() {
    this.formErrorMsg.textContent = '';
    this.personNameInput.classList.remove('is-invalid');
  }

  handleListActions(e) {
    const target = e.target;

    // Direct score click in Admin Mode
    if (this.isAdmin) {
      const displayEl = target.closest('.counter-touch-display');
      if (displayEl) {
        this.sound.playTap();
        this.openEditScoreModal(displayEl.dataset.id);
        return;
      }
    }

    const btn = target.closest('button');
    if (!btn) return;

    const personId = btn.dataset.id;
    if (!personId) return;

    const player = this.players.find(p => p.id === personId);
    if (!player) return;

    // Plus (+) button
    if (btn.classList.contains('touch-plus')) {
      player.count += 1;
      this.saveLocalPlayers();
      this.sound.playCoin();
      this.animateCounter(personId);
      this.checkNewLeaderCelebration();
      this.render();
      if (this.isOnlineHttp) {
        this.syncMutation('UPDATE_COUNT', {
          id: personId,
          name: player.name,
          delta: 1,
          setCount: player.count
        });
      }
      return;
    }

    // Minus (-) button
    if (btn.classList.contains('touch-minus')) {
      if (player.count > 0) {
        player.count -= 1;
        this.saveLocalPlayers();
        this.sound.playTap();
        this.animateCounter(personId);
        this.render();
        if (this.isOnlineHttp) {
          this.syncMutation('UPDATE_COUNT', {
            id: personId,
            name: player.name,
            delta: -1,
            setCount: player.count
          });
        }
      }
      return;
    }

    // Delete button
    if (btn.classList.contains('btn-trash-player')) {
      if (confirm(`Remove "${player.name}" from the arena?`)) {
        const deletedName = player.name;
        this.players = this.players.filter(p => p.id !== personId && p.name.toLowerCase() !== deletedName.toLowerCase());
        this.publishedPlayers = this.publishedPlayers.filter(p => p.id !== personId && p.name.toLowerCase() !== deletedName.toLowerCase());
        this.saveLocalPlayers();
        this.savePublishedPlayers();
        this.sound.playTap();
        this.showToast(`Removed "${deletedName}".`);
        this.render();
        if (this.isOnlineHttp) {
          this.syncMutation('DELETE_PERSON', { id: personId, name: deletedName });
        }
      }
      return;
    }
  }

  checkNewLeaderCelebration() {
    if (this.players.length === 0) return;
    const sorted = [...this.players].sort((a, b) => b.count - a.count);
    const currentLeader = sorted[0];

    if (currentLeader.count > 0 && this.previousLeader && currentLeader.id !== this.previousLeader.id) {
      this.sound.playCelebration();
      this.confetti.burst();
      this.showToast(`👑 ${currentLeader.name} took the #1 spot!`, 'success');
    }
    this.previousLeader = currentLeader;
  }

  animateCounter(personId) {
    setTimeout(() => {
      const el = document.querySelector(`.counter-touch-display[data-id="${personId}"]`);
      if (el) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    }, 10);
  }

  async syncMutation(action, payload) {
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer manitsuttagang`
        },
        body: JSON.stringify({ action, ...payload })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.people)) {
          this.mergeServerPeople(data.people);
        }
      }
    } catch (e) {}
  }

  mergeServerPeople(serverPeople) {
    if (!Array.isArray(serverPeople)) return;
    const cleanedServer = this.cleanPlayers(serverPeople);
    const playerMap = new Map();

    // Start with local players
    this.players.forEach(p => {
      const key = p.name.trim().toLowerCase();
      playerMap.set(key, { ...p });
    });

    // Merge server players
    cleanedServer.forEach(sp => {
      const key = sp.name.trim().toLowerCase();
      if (playerMap.has(key)) {
        const local = playerMap.get(key);
        // Ensure count is never reverted to 0
        const finalCount = Math.max(local.count, sp.count);
        playerMap.set(key, {
          ...local,
          id: sp.id || local.id,
          name: local.name || sp.name,
          count: finalCount
        });
      } else {
        playerMap.set(key, sp);
      }
    });

    this.players = this.cleanPlayers(Array.from(playerMap.values()));
    this.saveLocalPlayers();
    this.render();
  }

  async syncFromAPI() {
    try {
      const res = await fetch('/api/people');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.people)) {
          if (data.people.length > 0) {
            this.mergeServerPeople(data.people);
          } else if (this.players.length > 0 && this.isAdmin) {
            this.syncMutation('BULK_SAVE', { people: this.players });
          }
        }
      }
    } catch (e) {}
  }

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.syncFromAPI();
      }
    }, 5000);
  }

  // ==========================================================================
  // Render Methods
  // ==========================================================================

  render() {
    this.updateRoleUI();
    this.updateStats();
    this.renderTrackerList();
    this.renderLeaderboard();
  }

  updateRoleUI() {
    if (this.isAdmin) {
      this.modeBadge.className = 'mode-badge admin';
      this.modeText.textContent = '👑 Admin Mode';
      this.adminIconState.textContent = '🔓';
      this.adminQuickActions.hidden = false;
      if (this.adminLeaderboardNotice) this.adminLeaderboardNotice.hidden = false;

      this.adminAddCard.hidden = false;
      this.viewerBanner.hidden = true;
      this.listInstructionsText.textContent = 'Tap + or - to update items, or tap number to edit count';
      this.emptyDescText.textContent = 'Use the form above to add players and count items.';
    } else {
      this.modeBadge.className = 'mode-badge viewer';
      this.modeText.textContent = 'Viewer Mode (Read-Only)';
      this.adminIconState.textContent = '🔐';
      this.adminQuickActions.hidden = true;
      if (this.adminLeaderboardNotice) this.adminLeaderboardNotice.hidden = true;

      this.adminAddCard.hidden = true;
      this.viewerBanner.hidden = false;
      this.listInstructionsText.textContent = 'Viewing items taken per person (live updates)';
      this.emptyDescText.textContent = 'Log in as Admin to add participants and count items.';
    }
  }

  updateStats() {
    const totalPeople = this.players.length;
    const totalItems = this.players.reduce((sum, p) => sum + p.count, 0);

    this.navPeopleCount.textContent = totalPeople;
    this.headerTotalItems.textContent = totalItems.toLocaleString();
    this.statTotalPeople.textContent = totalPeople;
    this.statTotalItems.textContent = totalItems.toLocaleString();

    if (totalPeople === 0) {
      this.statCurrentLeader.textContent = '-';
      this.previousLeader = null;
    } else {
      const sorted = [...this.players].sort((a, b) => b.count - a.count);
      const leader = sorted[0];
      this.statCurrentLeader.textContent = leader.count > 0 ? `${leader.name}` : leader.name;
      this.previousLeader = leader;
    }
  }

  renderTrackerList() {
    if (this.players.length === 0) {
      this.peopleList.innerHTML = '';
      this.emptyState.hidden = false;
      this.noSearchResults.hidden = true;
      return;
    }

    this.emptyState.hidden = true;

    let filtered = this.players;
    if (this.searchQuery) {
      filtered = this.players.filter(p => p.name.toLowerCase().includes(this.searchQuery));
    }

    if (filtered.length === 0) {
      this.peopleList.innerHTML = '';
      this.noSearchResults.hidden = false;
      return;
    }

    this.noSearchResults.hidden = true;

    this.peopleList.innerHTML = filtered.map(player => {
      const isZero = player.count <= 0;

      const controlsHTML = this.isAdmin ? `
        <div class="admin-counter-cluster">
          <button 
            type="button" 
            class="counter-touch-btn touch-minus" 
            data-id="${player.id}"
            aria-label="Reduce count for ${this.escapeHtml(player.name)}"
            ${isZero ? 'disabled' : ''}
          >−</button>

          <span class="counter-touch-display" data-id="${player.id}" title="Tap to directly edit count">
            ${player.count}
          </span>

          <button 
            type="button" 
            class="counter-touch-btn touch-plus" 
            data-id="${player.id}"
            aria-label="Add item for ${this.escapeHtml(player.name)}"
          >+</button>

          <button 
            type="button" 
            class="btn-trash-player" 
            data-id="${player.id}"
            title="Delete player"
            aria-label="Delete player"
          >🗑️</button>
        </div>
      ` : `
        <div class="ranking-coin-badge" title="${player.count} items taken">
          <span class="coin-icon">🪙</span>
          <span>${player.count.toLocaleString()}</span>
        </div>
      `;

      return `
        <div class="player-row" data-id="${player.id}">
          <div class="player-info">
            <div class="player-avatar" aria-hidden="true">${this.getInitials(player.name)}</div>
            <div class="player-meta">
              <div class="player-name" title="${player.name}">${this.escapeHtml(player.name)}</div>
              <div class="player-sub">${player.count} ${player.count === 1 ? 'item' : 'items'} taken</div>
            </div>
          </div>
          ${controlsHTML}
        </div>
      `;
    }).join('');
  }

  // Render Page 2 Gaming Leaderboard (Stays frozen while Admin is editing)
  renderLeaderboard() {
    // When Admin is editing, keep leaderboard on published snapshot so scores don't jump around
    const listToRender = (this.isAdmin && this.publishedPlayers && this.publishedPlayers.length > 0)
      ? this.publishedPlayers
      : (this.publishedPlayers && this.publishedPlayers.length > 0 ? this.publishedPlayers : this.players);

    if (listToRender.length === 0) {
      this.podiumShowcase.innerHTML = '';
      this.restList.innerHTML = '';
      this.rankingsContainer.style.display = 'none';
      this.leaderboardEmpty.hidden = false;
      return;
    }

    this.leaderboardEmpty.hidden = true;
    this.rankingsContainer.style.display = 'block';

    const sorted = [...listToRender].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);

    this.renderTop3Podium(top3);
    this.renderRestRankings(rest);
  }

  // Robust Podium: Always visually balanced even with 1 or 2 players
  renderTop3Podium(top3) {
    const first = top3[0] || null;
    const second = top3[1] || null;
    const third = top3[2] || null;

    let html = '';

    // 2nd Place (Left)
    if (second) {
      html += `
        <div class="podium-pillar pillar-2">
          <div class="podium-avatar-wrapper">
            <div class="podium-avatar">${this.getInitials(second.name)}</div>
          </div>
          <div class="podium-player-name" title="${second.name}">${this.escapeHtml(second.name)}</div>
          <div class="podium-score-badge">
            <span class="podium-coin-icon">🪙</span>
            <span>${second.count.toLocaleString()}</span>
          </div>
          <div class="pedestal-block">2nd</div>
        </div>
      `;
    } else {
      // Balanced placeholder slot
      html += `
        <div class="podium-pillar pillar-2 pillar-placeholder">
          <div class="podium-avatar-wrapper">
            <div class="podium-avatar empty-spot">?</div>
          </div>
          <div class="podium-player-name">Waiting...</div>
          <div class="podium-score-badge">
            <span class="podium-coin-icon">🪙</span>
            <span>0</span>
          </div>
          <div class="pedestal-block">2nd</div>
        </div>
      `;
    }

    // 1st Place (Center - Champion)
    if (first) {
      html += `
        <div class="podium-pillar pillar-1">
          <div class="podium-avatar-wrapper">
            <span class="podium-floating-crown" title="Tap for celebration!">👑</span>
            <div class="podium-avatar">${this.getInitials(first.name)}</div>
          </div>
          <div class="podium-player-name" title="${first.name}">${this.escapeHtml(first.name)}</div>
          <div class="podium-score-badge">
            <span class="podium-coin-icon">🪙</span>
            <span>${first.count.toLocaleString()}</span>
          </div>
          <div class="pedestal-block">1st</div>
        </div>
      `;
    }

    // 3rd Place (Right)
    if (third) {
      html += `
        <div class="podium-pillar pillar-3">
          <div class="podium-avatar-wrapper">
            <div class="podium-avatar">${this.getInitials(third.name)}</div>
          </div>
          <div class="podium-player-name" title="${third.name}">${this.escapeHtml(third.name)}</div>
          <div class="podium-score-badge">
            <span class="podium-coin-icon">🪙</span>
            <span>${third.count.toLocaleString()}</span>
          </div>
          <div class="pedestal-block">3rd</div>
        </div>
      `;
    } else {
      // Balanced placeholder slot
      html += `
        <div class="podium-pillar pillar-3 pillar-placeholder">
          <div class="podium-avatar-wrapper">
            <div class="podium-avatar empty-spot">?</div>
          </div>
          <div class="podium-player-name">Waiting...</div>
          <div class="podium-score-badge">
            <span class="podium-coin-icon">🪙</span>
            <span>0</span>
          </div>
          <div class="pedestal-block">3rd</div>
        </div>
      `;
    }

    this.podiumShowcase.innerHTML = html;
  }

  // Rest of rankings (#4, #5...)
  renderRestRankings(rest) {
    this.restCountBadge.textContent = `${rest.length} ${rest.length === 1 ? 'player' : 'players'}`;

    if (rest.length === 0) {
      this.restList.innerHTML = '';
      this.restEmptyState.hidden = false;
      return;
    }

    this.restEmptyState.hidden = true;

    this.restList.innerHTML = rest.map((player, index) => {
      const rank = index + 4;
      return `
        <div class="ranking-row">
          <div class="ranking-left">
            <div class="ranking-num">${rank}</div>
            <div class="ranking-avatar" aria-hidden="true">${this.getInitials(player.name)}</div>
            <div class="ranking-name" title="${player.name}">${this.escapeHtml(player.name)}</div>
          </div>
          <div class="ranking-coin-badge">
            <span class="coin-icon">🪙</span>
            <span>${player.count.toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  showToast(msg, type = 'info') {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.className = 'neon-toast show';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2400);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ArenaTrackerApp();
});
