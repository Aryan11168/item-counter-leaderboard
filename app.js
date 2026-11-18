/**
 * Item Tracker & Leaderboard Application
 * Supports role-based access control (Admin vs View-Only),
 * Vercel Serverless API sync, and local storage fallback.
 */

const DEFAULT_PEOPLE = [
  { id: '1', name: 'Sophia Martinez', count: 18, createdAt: 1700000000000 },
  { id: '2', name: 'Liam Chen', count: 24, createdAt: 1700000010000 },
  { id: '3', name: 'Emma Watson', count: 15, createdAt: 1700000020000 },
  { id: '4', name: 'Marcus Johnson', count: 11, createdAt: 1700000030000 },
  { id: '5', name: 'Aria Patel', count: 7, createdAt: 1700000040000 },
  { id: '6', name: 'Noah Davis', count: 3, createdAt: 1700000050000 }
];

const LOCAL_STORAGE_KEY = 'item_tracker_people_v2';
const ADMIN_TOKEN_KEY = 'scoreboard_admin_token';

class ItemTrackerApp {
  constructor() {
    this.people = this.loadLocalPeople();
    this.searchQuery = '';
    this.currentPage = 'tracker';
    this.adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    this.isAdmin = Boolean(this.adminToken);
    this.apiAvailable = false;
    this.pollInterval = null;

    this.initDOMElements();
    this.initDialogAccessibility();
    this.initEventListeners();
    this.handleRoute();

    // Initial render
    this.render();

    // Fetch live state from backend and start real-time polling
    this.fetchDataFromAPI();
    this.startPolling();
  }

  // Load people from localStorage or fallback
  loadLocalPeople() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed reading localStorage:', e);
    }
    return DEFAULT_PEOPLE;
  }

  saveLocalPeople() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.people));
    } catch (e) {
      console.warn('Failed saving to localStorage:', e);
    }
  }

  initDOMElements() {
    // Navigation & Role Elements
    this.tabTracker = document.getElementById('tab-tracker');
    this.tabLeaderboard = document.getElementById('tab-leaderboard');
    this.pageTracker = document.getElementById('page-tracker');
    this.pageLeaderboard = document.getElementById('page-leaderboard');
    this.navPeopleCount = document.getElementById('nav-people-count');
    this.goToTrackerBtn = document.getElementById('go-to-tracker-btn');

    this.modeBadge = document.getElementById('mode-badge');
    this.modeText = document.getElementById('mode-text');
    this.btnAdminAuth = document.getElementById('btn-admin-auth');
    this.adminBtnText = document.getElementById('admin-btn-text');

    // Dialog Elements
    this.adminDialog = document.getElementById('admin-dialog');
    this.adminAuthForm = document.getElementById('admin-auth-form');
    this.adminPasswordInput = document.getElementById('admin-password-input');
    this.adminAuthError = document.getElementById('admin-auth-error');
    this.btnCloseDialog = document.getElementById('btn-close-dialog');
    this.btnCancelDialog = document.getElementById('btn-cancel-dialog');
    this.btnBannerLogin = document.getElementById('btn-banner-login');

    // Page 1 Elements
    this.viewerBanner = document.getElementById('viewer-info-banner');
    this.adminAddCard = document.getElementById('admin-add-card');
    this.addPersonForm = document.getElementById('add-person-form');
    this.personNameInput = document.getElementById('person-name-input');
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

    // Page 2 Elements
    this.podiumGrid = document.getElementById('podium-grid');
    this.restList = document.getElementById('rest-list');
    this.restCountBadge = document.getElementById('rest-count-badge');
    this.restEmptyState = document.getElementById('rest-empty-state');
    this.leaderboardEmpty = document.getElementById('leaderboard-empty');

    // Toast
    this.toastEl = document.getElementById('toast');
  }

  // Modern HTML5 Dialog light dismiss & backdrop handling
  initDialogAccessibility() {
    if (!this.adminDialog) return;

    // Fallback for browsers without native `closedby` attribute support (e.g. Safari)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      this.adminDialog.addEventListener('click', (event) => {
        if (event.target !== this.adminDialog) return;
        const rect = this.adminDialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isDialogContent) {
          this.closeAdminModal();
        }
      });
    }
  }

  initEventListeners() {
    // Nav tabs
    this.tabTracker.addEventListener('click', () => this.switchPage('tracker'));
    this.tabLeaderboard.addEventListener('click', () => this.switchPage('leaderboard'));
    if (this.goToTrackerBtn) {
      this.goToTrackerBtn.addEventListener('click', () => this.switchPage('tracker'));
    }

    // Hash route
    window.addEventListener('hashchange', () => this.handleRoute());

    // Role Auth button (Login or Logout)
    this.btnAdminAuth.addEventListener('click', () => {
      if (this.isAdmin) {
        this.logoutAdmin();
      } else {
        this.openAdminModal();
      }
    });

    if (this.btnBannerLogin) {
      this.btnBannerLogin.addEventListener('click', () => this.openAdminModal());
    }

    // Dialog close buttons
    this.btnCloseDialog.addEventListener('click', () => this.closeAdminModal());
    this.btnCancelDialog.addEventListener('click', () => this.closeAdminModal());

    // Admin Auth Form submit
    this.adminAuthForm.addEventListener('submit', (e) => this.handleAdminLogin(e));
    this.adminPasswordInput.addEventListener('input', () => {
      this.adminAuthError.textContent = '';
      this.adminPasswordInput.classList.remove('is-invalid');
    });

    // Add Person Form submit (Admin only)
    this.addPersonForm.addEventListener('submit', (e) => this.handleAddPerson(e));
    this.personNameInput.addEventListener('input', () => this.clearFormError());

    // Search input
    this.filterInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.clearSearchBtn.hidden = !this.searchQuery;
      this.renderTrackerList();
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.filterInput.value = '';
      this.searchQuery = '';
      this.clearSearchBtn.hidden = true;
      this.renderTrackerList();
      this.filterInput.focus();
    });

    // Counter and Delete button actions (Admin only)
    this.peopleList.addEventListener('click', (e) => this.handleListActions(e));

    // Pause polling when browser tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.fetchDataFromAPI();
      }
    });
  }

  // Polling backend for live multi-user score updates
  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetchDataFromAPI();
      }
    }, 5000);
  }

  // Fetch data from Vercel Serverless API
  async fetchDataFromAPI() {
    try {
      const headers = {};
      if (this.adminToken) {
        headers['Authorization'] = `Bearer ${this.adminToken}`;
      }

      const res = await fetch('/api/people', { headers });
      if (res.ok) {
        const data = await res.json();
        this.apiAvailable = true;
        if (Array.isArray(data.people)) {
          this.people = data.people;
          this.saveLocalPeople();
          this.render();
        }
      }
    } catch (err) {
      // Offline or local file preview; uses localStorage seamlessly
      this.apiAvailable = false;
    }
  }

  // Route Handling
  handleRoute() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'leaderboard') {
      this.switchPage('leaderboard', false);
    } else {
      this.switchPage('tracker', false);
    }
  }

  switchPage(page, updateHash = true) {
    this.currentPage = page;

    if (page === 'tracker') {
      this.tabTracker.classList.add('active');
      this.tabTracker.setAttribute('aria-selected', 'true');
      this.tabLeaderboard.classList.remove('active');
      this.tabLeaderboard.setAttribute('aria-selected', 'false');

      this.pageTracker.classList.add('active');
      this.pageLeaderboard.classList.remove('active');
      if (updateHash) window.location.hash = 'tracker';
    } else {
      this.tabLeaderboard.classList.add('active');
      this.tabLeaderboard.setAttribute('aria-selected', 'true');
      this.tabTracker.classList.remove('active');
      this.tabTracker.setAttribute('aria-selected', 'false');

      this.pageLeaderboard.classList.add('active');
      this.pageTracker.classList.remove('active');
      if (updateHash) window.location.hash = 'leaderboard';
    }

    this.render();
  }

  // ==========================================================================
  // Admin Authentication
  // ==========================================================================

  openAdminModal() {
    this.adminPasswordInput.value = '';
    this.adminAuthError.textContent = '';
    this.adminPasswordInput.classList.remove('is-invalid');
    this.adminDialog.showModal();
    this.adminPasswordInput.focus();
  }

  closeAdminModal() {
    this.adminDialog.close();
  }

  async handleAdminLogin(e) {
    e.preventDefault();
    const enteredPassword = this.adminPasswordInput.value.trim();

    if (!enteredPassword) {
      this.adminAuthError.textContent = 'Please enter the admin password.';
      this.adminPasswordInput.classList.add('is-invalid');
      return;
    }

    // If API is available, verify with server
    let isValid = false;
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${enteredPassword}`
        },
        body: JSON.stringify({ action: 'VERIFY_PASSWORD' })
      });

      if (res.ok) {
        isValid = true;
      } else {
        const data = await res.json().catch(() => ({}));
        this.adminAuthError.textContent = data.error || 'Incorrect admin password.';
        this.adminPasswordInput.classList.add('is-invalid');
        return;
      }
    } catch (err) {
      // Offline fallback: check default password
      if (enteredPassword === 'admin123') {
        isValid = true;
      } else {
        this.adminAuthError.textContent = 'Incorrect password. Default is "admin123".';
        this.adminPasswordInput.classList.add('is-invalid');
        return;
      }
    }

    if (isValid) {
      this.adminToken = enteredPassword;
      this.isAdmin = true;
      localStorage.setItem(ADMIN_TOKEN_KEY, enteredPassword);
      this.closeAdminModal();
      this.showToast('Unlocked Admin Mode! You can now add and edit items.', 'success');
      this.render();
      this.fetchDataFromAPI();
    }
  }

  logoutAdmin() {
    this.adminToken = '';
    this.isAdmin = false;
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    this.showToast('Exited Admin Mode. Scoreboard is now view-only.');
    this.render();
  }

  // ==========================================================================
  // Mutations (Add, Increment, Decrement, Delete)
  // ==========================================================================

  async handleAddPerson(e) {
    e.preventDefault();
    if (!this.isAdmin) {
      this.showToast('Admin access required to add people.', 'error');
      return;
    }

    const rawName = this.personNameInput.value.trim();

    if (!rawName) {
      this.showFormError('Please enter a person’s name.');
      this.personNameInput.focus();
      return;
    }

    if (rawName.length < 2) {
      this.showFormError('Name must be at least 2 characters long.');
      this.personNameInput.focus();
      return;
    }

    const duplicate = this.people.some(p => p.name.toLowerCase() === rawName.toLowerCase());
    if (duplicate) {
      this.showFormError(`"${rawName}" is already on the list.`);
      this.personNameInput.focus();
      return;
    }

    // Send to backend API if available
    let createdPerson = null;
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ action: 'ADD_PERSON', name: rawName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.people) {
          this.people = data.people;
          this.saveLocalPeople();
          this.render();
          createdPerson = data.person;
        }
      }
    } catch (err) {
      // Local fallback
    }

    if (!createdPerson) {
      const newPerson = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: rawName,
        count: 0,
        createdAt: Date.now()
      };
      this.people.unshift(newPerson);
      this.saveLocalPeople();
      createdPerson = newPerson;
      this.render();
    }

    this.personNameInput.value = '';
    this.clearFormError();
    this.showToast(`Added "${createdPerson.name}" with 0 items!`, 'success');

    // Smooth scroll to top of list
    setTimeout(() => {
      const firstItem = this.peopleList.querySelector('.person-item');
      if (firstItem) firstItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  showFormError(msg) {
    this.formErrorMsg.textContent = msg;
    this.personNameInput.classList.add('is-invalid');
  }

  clearFormError() {
    this.formErrorMsg.textContent = '';
    this.personNameInput.classList.remove('is-invalid');
  }

  async handleListActions(e) {
    if (!this.isAdmin) return;

    const target = e.target;
    const btn = target.closest('button');
    if (!btn) return;

    const personId = btn.dataset.id;
    if (!personId) return;

    const person = this.people.find(p => p.id === personId);
    if (!person) return;

    // Plus (+) button
    if (btn.classList.contains('btn-plus')) {
      person.count += 1;
      this.saveLocalPeople();
      this.animateCounter(personId);
      this.render();
      this.syncMutation('UPDATE_COUNT', { id: personId, delta: 1 });
      return;
    }

    // Minus (-) button
    if (btn.classList.contains('btn-minus')) {
      if (person.count > 0) {
        person.count -= 1;
        this.saveLocalPeople();
        this.animateCounter(personId);
        this.render();
        this.syncMutation('UPDATE_COUNT', { id: personId, delta: -1 });
      }
      return;
    }

    // Delete button
    if (btn.classList.contains('btn-delete-person')) {
      if (confirm(`Remove "${person.name}" from the list?`)) {
        this.people = this.people.filter(p => p.id !== personId);
        this.saveLocalPeople();
        this.showToast(`Removed "${person.name}".`);
        this.render();
        this.syncMutation('DELETE_PERSON', { id: personId });
      }
      return;
    }
  }

  async syncMutation(action, payload) {
    if (!this.isAdmin) return;
    try {
      await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken}`
        },
        body: JSON.stringify({ action, ...payload })
      });
    } catch (err) {
      // Local changes remain stored
    }
  }

  animateCounter(personId) {
    setTimeout(() => {
      const counterEl = document.querySelector(`.counter-value[data-id="${personId}"]`);
      if (counterEl) {
        counterEl.classList.remove('pop');
        void counterEl.offsetWidth;
        counterEl.classList.add('pop');
      }
    }, 10);
  }

  // ==========================================================================
  // Rendering
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
      this.modeText.textContent = '👑 Admin Mode (Can Edit)';
      this.btnAdminAuth.className = 'btn btn-sm btn-outline btn-logout';
      this.adminBtnText.textContent = 'Exit Admin';

      this.adminAddCard.hidden = false;
      this.viewerBanner.hidden = true;
      this.listInstructionsText.textContent = 'Use plus (+) or minus (-) buttons to update items taken.';
      this.emptyDescText.textContent = 'Use the form above to add participants and start counting items.';
    } else {
      this.modeBadge.className = 'mode-badge viewer';
      this.modeText.textContent = 'Viewer Mode (Read-Only)';
      this.btnAdminAuth.className = 'btn btn-sm btn-outline';
      this.adminBtnText.textContent = 'Admin Login';

      this.adminAddCard.hidden = true;
      this.viewerBanner.hidden = false;
      this.listInstructionsText.textContent = 'Viewing current items taken per person (live updates enabled).';
      this.emptyDescText.textContent = 'Sign in as Admin to add participants and start counting items.';
    }
  }

  updateStats() {
    const totalPeople = this.people.length;
    const totalItems = this.people.reduce((sum, p) => sum + p.count, 0);

    this.navPeopleCount.textContent = totalPeople;
    this.statTotalPeople.textContent = totalPeople;
    this.statTotalItems.textContent = totalItems;

    if (totalPeople === 0) {
      this.statCurrentLeader.textContent = '-';
    } else {
      const sorted = [...this.people].sort((a, b) => b.count - a.count);
      const leader = sorted[0];
      this.statCurrentLeader.textContent = leader.count > 0 ? `${leader.name} (${leader.count})` : leader.name;
    }
  }

  renderTrackerList() {
    if (this.people.length === 0) {
      this.peopleList.innerHTML = '';
      this.emptyState.hidden = false;
      this.noSearchResults.hidden = true;
      return;
    }

    this.emptyState.hidden = true;

    let filtered = this.people;
    if (this.searchQuery) {
      filtered = this.people.filter(p => p.name.toLowerCase().includes(this.searchQuery));
    }

    if (filtered.length === 0) {
      this.peopleList.innerHTML = '';
      this.noSearchResults.hidden = false;
      return;
    }

    this.noSearchResults.hidden = true;

    this.peopleList.innerHTML = filtered.map(person => {
      const isZero = person.count <= 0;

      // In Admin Mode: Render interactive Plus, Minus, and Delete buttons
      // In Viewer Mode: Render clean read-only badge with count only
      const controlsHTML = this.isAdmin ? `
        <div class="counter-group">
          <button 
            type="button" 
            class="counter-btn btn-minus" 
            data-id="${person.id}"
            aria-label="Decrease items for ${this.escapeHtml(person.name)}"
            title="Decrease count"
            ${isZero ? 'disabled' : ''}
          >−</button>

          <span class="counter-value" data-id="${person.id}" aria-label="${person.count} items">
            ${person.count}
          </span>

          <button 
            type="button" 
            class="counter-btn btn-plus" 
            data-id="${person.id}"
            aria-label="Increase items for ${this.escapeHtml(person.name)}"
            title="Add 1 item"
          >+</button>
        </div>

        <button 
          type="button" 
          class="btn-delete-person" 
          data-id="${person.id}"
          aria-label="Delete ${this.escapeHtml(person.name)}"
          title="Delete Person"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      ` : `
        <div class="viewer-count-pill" title="${person.count} items taken">
          <span class="viewer-count-number">${person.count}</span>
          <span class="viewer-count-label">${person.count === 1 ? 'item' : 'items'}</span>
        </div>
      `;

      return `
        <div class="person-item" data-id="${person.id}">
          <div class="person-info">
            <div class="person-avatar" aria-hidden="true">${this.getInitials(person.name)}</div>
            <div class="person-name-wrapper">
              <div class="person-name" title="${person.name}">${this.escapeHtml(person.name)}</div>
              <div class="person-items-subtitle">${person.count} ${person.count === 1 ? 'item' : 'items'} taken</div>
            </div>
          </div>
          ${controlsHTML}
        </div>
      `;
    }).join('');
  }

  // Page 2: Leaderboard (Top 3 with BIG names, rest in descending count)
  renderLeaderboard() {
    if (this.people.length === 0) {
      this.podiumGrid.innerHTML = '';
      this.restList.innerHTML = '';
      this.leaderboardEmpty.hidden = false;
      document.querySelector('.top3-container').style.display = 'none';
      document.querySelector('.rest-card').style.display = 'none';
      return;
    }

    this.leaderboardEmpty.hidden = true;
    document.querySelector('.top3-container').style.display = 'block';
    document.querySelector('.rest-card').style.display = 'block';

    const sorted = [...this.people].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);

    this.renderTop3Podium(top3);
    this.renderRestList(rest);
  }

  renderTop3Podium(top3) {
    if (top3.length === 0) {
      this.podiumGrid.innerHTML = '';
      return;
    }

    const first = top3[0] || null;
    const second = top3[1] || null;
    const third = top3[2] || null;

    let html = '';

    // 2nd Place (Left)
    if (second) {
      html += `
        <div class="podium-card podium-2">
          <div class="podium-rank-badge">🥈 2nd Place</div>
          <div class="podium-crown">🥈</div>
          <div class="podium-avatar">${this.getInitials(second.name)}</div>
          <h3 class="podium-name">${this.escapeHtml(second.name)}</h3>
          <div class="podium-items-pill">
            <span class="podium-items-count">${second.count}</span>
            <span class="podium-items-label">${second.count === 1 ? 'item' : 'items'}</span>
          </div>
          <div class="podium-pedestal">2</div>
        </div>
      `;
    }

    // 1st Place (Center - Biggest)
    if (first) {
      html += `
        <div class="podium-card podium-1">
          <div class="podium-rank-badge">👑 1st Champion</div>
          <div class="podium-crown">👑</div>
          <div class="podium-avatar">${this.getInitials(first.name)}</div>
          <h3 class="podium-name">${this.escapeHtml(first.name)}</h3>
          <div class="podium-items-pill">
            <span class="podium-items-count">${first.count}</span>
            <span class="podium-items-label">${first.count === 1 ? 'item' : 'items'}</span>
          </div>
          <div class="podium-pedestal">1</div>
        </div>
      `;
    }

    // 3rd Place (Right)
    if (third) {
      html += `
        <div class="podium-card podium-3">
          <div class="podium-rank-badge">🥉 3rd Place</div>
          <div class="podium-crown">🥉</div>
          <div class="podium-avatar">${this.getInitials(third.name)}</div>
          <h3 class="podium-name">${this.escapeHtml(third.name)}</h3>
          <div class="podium-items-pill">
            <span class="podium-items-count">${third.count}</span>
            <span class="podium-items-label">${third.count === 1 ? 'item' : 'items'}</span>
          </div>
          <div class="podium-pedestal">3</div>
        </div>
      `;
    }

    this.podiumGrid.innerHTML = html;
  }

  renderRestList(rest) {
    this.restCountBadge.textContent = `${rest.length} ${rest.length === 1 ? 'participant' : 'participants'}`;

    if (rest.length === 0) {
      this.restList.innerHTML = '';
      this.restEmptyState.hidden = false;
      return;
    }

    this.restEmptyState.hidden = true;

    this.restList.innerHTML = rest.map((person, index) => {
      const rank = index + 4;
      return `
        <div class="rest-item">
          <div class="rest-left">
            <div class="rest-rank">#${rank}</div>
            <div class="rest-avatar" aria-hidden="true">${this.getInitials(person.name)}</div>
            <div class="rest-name" title="${person.name}">${this.escapeHtml(person.name)}</div>
          </div>
          <div class="rest-right">
            <span class="rest-item-count">${person.count}</span>
            <span class="rest-item-unit">${person.count === 1 ? 'item' : 'items'}</span>
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

  showToast(message, type = 'info') {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.className = 'toast show';
    if (type === 'success') {
      this.toastEl.classList.add('toast-success');
    } else if (type === 'error') {
      this.toastEl.classList.add('toast-error');
    }

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
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
  window.app = new ItemTrackerApp();
});
