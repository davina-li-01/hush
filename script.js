const FACTORS = [
  { name: 'Noise', color: '#7c3aed', icon: 'volume-2' },
  { name: 'Light', color: '#eab308', icon: 'sun' },
  { name: 'Chemicals', color: '#ef4444', icon: 'alert-triangle' },
  { name: 'Crowds', color: '#3b82f6', icon: 'users' },
  { name: 'UV', color: '#f97316', icon: 'sun-medium' },
  { name: 'Air Quality', color: '#22c55e', icon: 'wind' },
  { name: 'Temperature', color: '#14b8a6', icon: 'thermometer' },
  { name: 'Pollen', color: '#ec4899', icon: 'flower' },
];

const ILLNESS_OPTIONS = [
  'Migraine',
  'Chronic Fatigue Syndrome',
  'Fibromyalgia',
  'Asthma',
  'Lupus',
  'Long COVID',
  'Multiple Sclerosis',
  'Endometriosis',
  'Ehlers-Danlos Syndrome',
  'Irritable Bowel Syndrome',
];

const FALLBACK_ILLNESS_TRIGGER_MAP = {
  Migraine: ['Light', 'Noise', 'Chemicals', 'Temperature'],
  Asthma: ['Air Quality', 'Pollen', 'Chemicals', 'Temperature'],
  Fibromyalgia: ['Temperature', 'Noise', 'Crowds'],
  'Chronic Fatigue Syndrome': ['Temperature', 'Crowds', 'Chemicals'],
  'Long COVID': ['Air Quality', 'Temperature', 'Crowds'],
  'Multiple Sclerosis': ['Temperature', 'Light'],
};

const BOSTON = { lat: 42.36, lng: -71.06 };
const STORAGE_KEY = 'hush_state_v2';
const AUTH_USERS_KEY = 'hush_auth_users_v1';
const AUTH_SESSION_KEY = 'hush_auth_session_v1';

const state = {
  userProfile: { selectedIllness: '' },
  illnesses: [],
  triggers: [],
  events: [],
  activeFilters: FACTORS.map((f) => f.name),
  mapData: [],
  currentView: 'landing',
  onboardingStep: 1,
  appTab: 'map',
  weather: null,
  weatherStatus: 'idle',
  weatherError: '',
  eventFeedStatus: 'idle',
  eventFeedError: '',
  autoTriggerSuggestions: [],
  searchLocationText: '',
  logSearch: '',
  logFilter: 'All',
  logSort: 'newest',
  currentLocation: null,
  destinationLocation: null,
  routeInfo: null,
  locationError: '',
  onboardingLoading: false,
  onboardingError: '',
  onboardingRequestId: 0,
  illnessDraft: '',
  triggerDraft: '',
  authMode: 'signin',
  authNameDraft: '',
  authEmailDraft: '',
  authPasswordDraft: '',
  authConfirmPasswordDraft: '',
  authError: '',
  authLoading: false,
  isAuthenticated: false,
  sessionEmail: '',
  mapHintShown: false,
  drawerOpen: false,
};

let map = null;
let markerLayer = [];
let heatLayer = null;
let pendingMapClick = null;
let userLocationMarker = null;
let destinationMarker = null;
let routePolyline = null;
let locationWatchId = null;

function saveState() {
  const data = {
    userProfile: state.userProfile,
    illnesses: state.illnesses,
    triggers: state.triggers,
    events: state.events,
    activeFilters: state.activeFilters,
    logSearch: state.logSearch,
    logFilter: state.logFilter,
    logSort: state.logSort,
    mapHintShown: state.mapHintShown,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.userProfile = saved.userProfile || state.userProfile;
    state.illnesses = saved.illnesses || [];
    state.triggers = saved.triggers || [];
    state.events = saved.events || [];
    state.activeFilters = saved.activeFilters?.length ? saved.activeFilters : FACTORS.map((f) => f.name);
    state.logSearch = saved.logSearch || '';
    state.logFilter = saved.logFilter || 'All';
    state.logSort = saved.logSort || 'newest';
    state.mapHintShown = Boolean(saved.mapHintShown);
  } catch {}
}

function loadAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
    if (session?.email) {
      state.isAuthenticated = true;
      state.sessionEmail = session.email;
      if (!state.userProfile.email) state.userProfile.email = session.email;
      if (!state.userProfile.name) {
        state.userProfile.name = session.name || session.email.split('@')[0];
      }
    }
  } catch {}
}

function navigate(view) {
  state.currentView = view;
  render();
}

function setTab(tab) {
  state.appTab = tab;
  state.drawerOpen = false;
  render();
}

function openDrawer() {
  state.drawerOpen = true;
  document.querySelector('.drawer')?.classList.add('open');
  document.querySelector('.drawer-backdrop')?.classList.add('open');
}

function closeDrawer() {
  if (!state.drawerOpen) return;
  state.drawerOpen = false;
  document.querySelector('.drawer')?.classList.remove('open');
  document.querySelector('.drawer-backdrop')?.classList.remove('open');
}

function render() {
  const app = document.getElementById('app');
  if (state.currentView === 'landing') {
    app.innerHTML = landingHTML();
    refreshIcons();
    return;
  }
  if (state.currentView === 'auth') {
    app.innerHTML = authHTML();
    refreshIcons();
    return;
  }
  if (state.currentView === 'onboarding') {
    app.innerHTML = onboardingHTML();
    refreshIcons();
    return;
  }
  app.innerHTML = shellHTML();
  renderMain();
  refreshIcons();
}

function landingHTML() {
  return `<section class="landing view">
    <div class="logo">Hush</div>
    <h1>Hush</h1>
    <p>It's not just a tool, it's a lifeline</p>
    <button class="btn primary" onclick="beginExperience()">Get Started</button>
  </section>`;
}

function beginExperience() {
  if (!state.isAuthenticated) {
    state.currentView = 'auth';
    render();
    return;
  }

  state.currentView = state.illnesses.length || state.triggers.length ? 'app' : 'onboarding';
  if (state.currentView === 'onboarding') state.onboardingStep = 1;
  render();
}

function authHTML() {
  const isSignIn = state.authMode === 'signin';
  return `<section class="onboarding view">
    <div class="card">
      <h2>${isSignIn ? 'Sign in to Hush' : 'Create your Hush account'}</h2>
      <p class="subtle">Secure local session. Your onboarding stays linked to your profile on this device.</p>
    </div>

    <div class="card auth-tabs">
      <button class="btn ${isSignIn ? 'primary' : 'ghost'}" onclick="setAuthMode('signin')">Sign In</button>
      <button class="btn ${!isSignIn ? 'primary' : 'ghost'}" onclick="setAuthMode('signup')">Sign Up</button>
    </div>

    <div class="card">
      ${
        !isSignIn
          ? '<input class="input" id="auth-name" placeholder="Full name" value="' +
            escapeHtml(state.authNameDraft) +
            '" oninput="state.authNameDraft=this.value">'
          : ''
      }
      <input class="input" id="auth-email" style="margin-top:${isSignIn ? '0' : '10px'}" placeholder="Email" autocomplete="email" value="${escapeHtml(state.authEmailDraft)}" oninput="state.authEmailDraft=this.value">
      <input class="input" id="auth-password" style="margin-top:10px" type="password" autocomplete="current-password" placeholder="Password" value="${escapeHtml(state.authPasswordDraft)}" oninput="state.authPasswordDraft=this.value" onkeydown="if(event.key==='Enter'){submitAuth();}">
      ${
        !isSignIn
          ? '<input class="input" id="auth-confirm" style="margin-top:10px" type="password" autocomplete="new-password" placeholder="Confirm password" value="' +
            escapeHtml(state.authConfirmPasswordDraft) +
            '" oninput="state.authConfirmPasswordDraft=this.value" onkeydown="if(event.key===\'Enter\'){submitAuth();}">'
          : ''
      }
      ${state.authError ? `<p class="subtle" style="margin-top:10px;color:#fecaca;">${escapeHtml(state.authError)}</p>` : ''}
    </div>

    <div class="onboarding-actions">
      <button class="btn ghost" onclick="navigate('landing')">Back</button>
      <button class="btn primary" ${state.authLoading ? 'disabled' : ''} onclick="submitAuth()">${state.authLoading ? 'Please wait...' : isSignIn ? 'Sign In' : 'Create Account'}</button>
    </div>
  </section>`;
}

function onboardingHTML() {
  const illnessTags = state.illnesses
    .map((item, i) => `<span class="tag">${escapeHtml(item)}<button onclick="removeIllness(${i})">✕</button></span>`)
    .join('');

  const triggerTags = state.triggers
    .map((item, i) => `<span class="tag">${escapeHtml(item)}<button onclick="removeTrigger(${i})">✕</button></span>`)
    .join('');

  const stepHeader = `<div class="card onboarding-progress">
    <div class="step-label">Step ${state.onboardingStep} of 2</div>
    <div class="step-track">
      <span class="step-dot ${state.onboardingStep >= 1 ? 'active' : ''}">1</span>
      <span class="step-line ${state.onboardingStep === 2 ? 'active' : ''}"></span>
      <span class="step-dot ${state.onboardingStep >= 2 ? 'active' : ''}">2</span>
    </div>
  </div>`;

  if (state.onboardingStep === 1) {
    return `<section class="onboarding view">
      ${stepHeader}
      <div class="card">
        <h2>Step 1: Tell us about your invisible illnesses</h2>
        <p class="subtle">Add your condition manually or choose from common hidden illnesses.</p>
      </div>

      <div class="card">
        <div class="row" style="margin-bottom:8px;">
          <select id="common-illness-select" ${state.onboardingLoading ? 'disabled' : ''} onchange="onSelectCommonIllness(this.value)">
            <option value="">Choose a common illness</option>
            ${ILLNESS_OPTIONS.map((illness) => `<option value="${escapeHtml(illness)}">${escapeHtml(illness)}</option>`).join('')}
          </select>
        </div>
        <p class="subtle">Selecting one fetches real reference data and auto-selects likely trigger factors.</p>
        ${state.onboardingLoading ? '<p class="subtle" style="margin-top:8px;">Loading trigger suggestions...</p>' : ''}
        ${state.onboardingError ? `<p class="subtle" style="margin-top:8px;color:#fecaca;">${escapeHtml(state.onboardingError)}</p>` : ''}
      </div>

      <div class="card">
        <div class="row">
          <input id="illness-input" value="${escapeHtml(state.illnessDraft)}" oninput="state.illnessDraft=this.value" placeholder="e.g., Chronic Fatigue Syndrome" onkeydown="if(event.key==='Enter'){addIllness();}">
          <button class="btn primary" ${state.onboardingLoading ? 'disabled' : ''} onclick="addIllness()">+</button>
        </div>
        <div class="tags">${illnessTags || '<span class="subtle">No illnesses added yet.</span>'}</div>
      </div>

      ${state.autoTriggerSuggestions.length ? `<div class="card"><p class="subtle">Auto-selected factors from illness data:</p><div class="tags">${state.autoTriggerSuggestions.map((f) => `<span class="tag">${f}</span>`).join('')}</div></div>` : ''}

      <div class="onboarding-actions">
        <button class="btn ghost" onclick="navigate('landing')">Back</button>
        <button class="btn primary" onclick="goToOnboardingStep2()">Next</button>
      </div>
    </section>`;
  }

  return `<section class="onboarding view">
    ${stepHeader}
    <div class="card">
      <h2>Step 2: What are your known triggers?</h2>
      <p class="subtle">You can add personal trigger labels. Factor triggers inferred from illness data are already selected.</p>
    </div>

    <div class="card">
      <div class="row">
        <input id="trigger-input" value="${escapeHtml(state.triggerDraft)}" oninput="state.triggerDraft=this.value" placeholder="e.g., Loud subway station" onkeydown="if(event.key==='Enter'){addTrigger();}">
        <button class="btn primary" onclick="addTrigger()">+</button>
      </div>
      <div class="tags">${triggerTags || '<span class="subtle">No personal triggers added yet.</span>'}</div>
    </div>

    <div class="card">
      <p class="subtle">Track Interests</p>
      <div class="pill-grid">${renderFactorPills()}</div>
    </div>

    <div class="onboarding-actions">
      <button class="btn ghost" onclick="goToOnboardingStep1()">Back</button>
      <button class="btn primary" onclick="finishOnboarding()">Done</button>
    </div>
  </section>`;
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.authError = '';
  state.authPasswordDraft = '';
  state.authConfirmPasswordDraft = '';
  render();
}

function getAuthUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY));
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveAuthUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function createSalt() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    const raw = `${salt}:${password}`;
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 33) ^ raw.charCodeAt(i);
    }
    return `fallback_${(hash >>> 0).toString(16)}`;
  }
  const encoder = new TextEncoder();
  const msg = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', msg);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

async function submitAuth() {
  const mode = state.authMode;
  const name = state.authNameDraft.trim();
  const email = state.authEmailDraft.trim().toLowerCase();
  const password = state.authPasswordDraft;
  const confirmPassword = state.authConfirmPasswordDraft;

  state.authError = '';

  if (!isValidEmail(email)) {
    state.authError = 'Enter a valid email address.';
    render();
    return;
  }

  if (!password) {
    state.authError = 'Password is required.';
    render();
    return;
  }

  state.authLoading = true;
  render();

  try {
    const users = getAuthUsers();

    if (mode === 'signup') {
      if (!name) {
        state.authError = 'Full name is required.';
        state.authLoading = false;
        render();
        return;
      }

      if (!isStrongPassword(password)) {
        state.authError = 'Use at least 8 chars, with 1 uppercase letter and 1 number.';
        state.authLoading = false;
        render();
        return;
      }

      if (password !== confirmPassword) {
        state.authError = 'Passwords do not match.';
        state.authLoading = false;
        render();
        return;
      }

      if (users.some((u) => u.email === email)) {
        state.authError = 'An account with this email already exists.';
        state.authLoading = false;
        render();
        return;
      }

      const salt = createSalt();
      const passwordHash = await hashPassword(password, salt);

      users.push({ email, name, salt, passwordHash, createdAt: Date.now() });
      saveAuthUsers(users);

      state.userProfile.name = name;
      state.userProfile.email = email;
    } else {
      const user = users.find((u) => u.email === email);
      if (!user) {
        state.authError = 'Account not found. Create one first.';
        state.authLoading = false;
        render();
        return;
      }

      const hash = await hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        state.authError = 'Incorrect password.';
        state.authLoading = false;
        render();
        return;
      }

      state.userProfile.name = user.name;
      state.userProfile.email = user.email;
    }

    state.isAuthenticated = true;
    state.sessionEmail = email;
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ email, name: state.userProfile.name || email.split('@')[0], createdAt: Date.now() })
    );

    state.authPasswordDraft = '';
    state.authConfirmPasswordDraft = '';
    state.authLoading = false;
    saveState();

    state.currentView = state.illnesses.length || state.triggers.length ? 'app' : 'onboarding';
    if (state.currentView === 'onboarding') state.onboardingStep = 1;
    render();
  } catch {
    state.authLoading = false;
    state.authError = 'Authentication failed. Please try again.';
    render();
  }
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  state.isAuthenticated = false;
  state.sessionEmail = '';
  closeModal();
  state.currentView = 'landing';
  render();
}

function openProfileModal() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const name = state.userProfile.name || state.sessionEmail?.split('@')[0] || 'Hush User';
  const email = state.userProfile.email || state.sessionEmail || 'Not available';

  overlay.innerHTML = `<div class="modal">
    <h3>Profile</h3>
    <div class="card" style="padding:12px;">
      <div class="subtle">Name</div>
      <div style="font-weight:700;">${escapeHtml(name)}</div>
      <div class="subtle" style="margin-top:10px;">Email</div>
      <div style="font-weight:600;">${escapeHtml(email)}</div>
      <div class="subtle" style="margin-top:10px;">Tracked illnesses</div>
      <div>${state.illnesses.length}</div>
      <div class="subtle" style="margin-top:10px;">Logged events</div>
      <div>${state.events.length}</div>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">Close</button>
      <button class="btn primary" onclick="logout()">Log Out</button>
    </div>
  </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
}

function closeModal() {
  document.querySelector('.overlay')?.remove();
}

function showToast(message, duration = 2400) {
  const oldToast = document.querySelector('.toast-notice');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notice';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

function shellHTML() {
  const drawerTriggers = state.triggers.length
    ? state.triggers.slice(0, 6).map((t) => `<li>${escapeHtml(t)}</li>`).join('')
    : '<li class="subtle">No triggers added yet</li>';

  return `<section class="shell view">
    <div class="drawer-backdrop ${state.drawerOpen ? 'open' : ''}" onclick="closeDrawer()"></div>
    <aside class="drawer ${state.drawerOpen ? 'open' : ''}">
      <div class="drawer-header">
        <h3>Menu</h3>
        <button class="icon" onclick="closeDrawer()">${icon('x', 20)}</button>
      </div>
      <button class="drawer-item" onclick="openProfileModal();closeDrawer();">${icon('user-round', 16)}<span>Profile</span></button>
      <button class="drawer-item">${icon('map-pinned', 16)}<span>Saved Locations</span></button>
      <div class="drawer-section">
        <div class="drawer-title">User Triggers</div>
        <ul class="drawer-list">${drawerTriggers}</ul>
      </div>
      <button class="drawer-item">${icon('settings', 16)}<span>Settings</span></button>
    </aside>

    <header class="header">
      <button class="icon" aria-label="menu" onclick="openDrawer()">${icon('menu', 20)}</button>
      <h1>HUSH</h1>
      <button class="icon" aria-label="profile" onclick="openProfileModal()">${icon('circle-user-round', 20)}</button>
    </header>

    <main id="main" class="main"></main>

    <nav class="bottom-nav">
      <button class="${state.appTab === 'logs' ? 'active' : ''}" onclick="setTab('logs')"><span class="nav-icon">${icon('clipboard-list', 19)}</span>Logs</button>
      <button class="${state.appTab === 'map' ? 'active' : ''}" onclick="setTab('map')"><span class="nav-icon">${icon('map', 19)}</span>Map</button>
      <button class="${state.appTab === 'conditions' ? 'active' : ''}" onclick="setTab('conditions')"><span class="nav-icon">${icon('bar-chart-3', 19)}</span>Conditions</button>
    </nav>
  </section>`;
}

function renderMain() {
  const main = document.getElementById('main');
  if (state.appTab === 'map') {
    main.innerHTML = mapHTML();
    initMapView();
    return;
  }
  if (state.appTab === 'logs') {
    main.innerHTML = logsHTML();
    return;
  }
  main.innerHTML = conditionsHTML();
  if (state.weatherStatus === 'idle') fetchWeather();
}

function mapHTML() {
  const preview = routePreviewHTML();
  return `<section class="map-wrap">
    <div class="map-top-card">
      <div class="search-main-row">
        <input id="map-search" value="${escapeHtml(state.searchLocationText)}" placeholder="Search destination" onkeydown="if(event.key==='Enter'){searchLocation();}">
        <button class="btn primary icon-btn" onclick="searchLocation()">${icon('search', 18)}</button>
      </div>

      <div class="nav-action-row">
        <button class="btn ghost" onclick="centerOnCurrentLocation()">${icon('locate-fixed', 16)} <span>Locate Me</span></button>
        <button class="btn primary" onclick="startNavigation()">${icon('navigation', 16)} <span>Start Navigation</span></button>
      </div>

      <div id="route-preview-slot">${preview}</div>
    </div>

    <div id="map"></div>

    <details class="filters-panel" open>
      <summary>Environmental Filters</summary>
      <div class="pill-grid" style="margin-top:10px;">${renderFactorPills()}</div>
    </details>
  </section>`;
}

function updateRoutePreviewUI() {
  const slot = document.getElementById('route-preview-slot');
  if (!slot) return;
  slot.innerHTML = routePreviewHTML();
  refreshIcons();
}

function routePreviewHTML() {
  if (!state.destinationLocation) return '';

  const origin = state.currentLocation || BOSTON;
  const km = haversineKm(origin.lat, origin.lng, state.destinationLocation.lat, state.destinationLocation.lng);
  const minutes = Math.max(3, Math.round((km / 4.8) * 60));

  return `<div class="route-preview">
    <div>
      <div class="route-title">Route preview</div>
      <div class="route-subtle">${escapeHtml(state.destinationLocation.label || 'Destination selected')}</div>
    </div>
    <div class="route-meta">${km.toFixed(1)} km · ${minutes} min</div>
  </div>`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function logsHTML() {
  const filtered = getFilteredEvents();
  return `<section class="logs">
    <h2>Logged Events</h2>

    <div class="search-row">
      <input class="input" placeholder="Search events" value="${escapeHtml(state.logSearch)}" oninput="state.logSearch=this.value;saveState();render();">
      <select onchange="state.logFilter=this.value;saveState();render();">
        <option ${state.logFilter === 'All' ? 'selected' : ''}>All</option>
        ${FACTORS.map((f) => `<option ${state.logFilter === f.name ? 'selected' : ''}>${f.name}</option>`).join('')}
      </select>
      <select onchange="state.logSort=this.value;saveState();render();">
        <option value="newest" ${state.logSort === 'newest' ? 'selected' : ''}>Newest</option>
        <option value="oldest" ${state.logSort === 'oldest' ? 'selected' : ''}>Oldest</option>
      </select>
    </div>

    <div class="event-list">
      ${
        filtered.length
          ? filtered
              .map(
                (ev) => `<article class="event">
                  <div>
                    <strong>${escapeHtml(ev.trigger)}</strong>
                    <small>${new Date(ev.timestamp).toLocaleString()}</small>
                    <div class="coord">${ev.factor ? `${escapeHtml(ev.factor)} · ` : ''}${ev.lat?.toFixed(4)}, ${ev.lng?.toFixed(4)}</div>
                  </div>
                  <button class="x" onclick="deleteEvent('${ev.id}')">✕</button>
                </article>`
              )
              .join('')
          : '<div class="empty"><strong>No events logged yet</strong><p class="subtle" style="margin-top:6px;">Log events from the map screen</p></div>'
      }
    </div>
  </section>`;
}

function conditionsHTML() {
  if (state.weatherStatus === 'loading') {
    return `<section class="conditions"><h2>Conditions</h2><div class="loading"><span class="spinner"></span><span>Loading...</span></div></section>`;
  }

  if (state.weatherStatus === 'error') {
    return `<section class="conditions"><h2>Conditions</h2><div class="error">${escapeHtml(state.weatherError || 'Unable to fetch conditions.')}</div><button class="btn ghost" onclick="fetchWeather()">Retry</button></section>`;
  }

  const weather = state.weather || {};
  const temp = Number(weather.temperature ?? 20);
  const wind = Number(weather.windspeed ?? 8);
  const time = weather.time || '--';

  const wellbeing = Math.max(15, Math.min(96, Math.round(88 - Math.abs(temp - 21) * 1.7 - wind * 0.6)));

  const cards = [
    {
      label: 'Temperature',
      icon: 'thermometer',
      value: `${temp}°C`,
      text: temp > 30 ? 'Heat is high. Consider cooling measures.' : temp < 6 ? 'Cold stress is possible. Keep warm.' : 'Temperature is in a moderate range.',
    },
    {
      label: 'Noise',
      icon: 'volume-2',
      value: randomMetric('Noise'),
      text: 'City activity indicates moderate acoustic intensity.',
    },
    {
      label: 'Light',
      icon: 'sun',
      value: randomMetric('Light'),
      text: 'Ambient light appears manageable in most blocks.',
    },
    {
      label: 'Chemicals',
      icon: 'alert-triangle',
      value: randomMetric('Chemicals'),
      text: 'No major anomaly detected. Avoid strong scent hotspots.',
    },
    {
      label: 'Crowds',
      icon: 'users',
      value: randomMetric('Crowds'),
      text: 'Transit and venue zones may have denser crowd pockets.',
    },
  ];

  return `<section class="conditions">
    <h2>Conditions</h2>
    <div class="subtle">Boston, MA · Updated ${escapeHtml(time)}</div>

    <div class="card">
      <div class="subtle" style="margin-bottom:8px;">Track Interests</div>
      <div class="pill-grid">${renderFactorPills()}</div>
    </div>

    <div class="stat-grid">
      <div class="stat score">
        <div class="subtle">Wellbeing Score</div>
        <div class="big">${wellbeing}%</div>
      </div>
      <div class="stat">
        <div class="subtle">Wind Speed</div>
        <div style="font-size:28px;font-weight:800;">${wind}</div>
        <div class="subtle">km/h</div>
      </div>
    </div>

    <div class="cond-grid">
      ${cards
        .filter((c) => state.activeFilters.includes(c.label) || ['Noise', 'Light', 'Chemicals', 'Crowds'].includes(c.label))
        .map(
          (c) => `<article class="cond-card">
            <div class="cond-icon">${icon(c.icon, 17)}</div>
            <div><strong>${c.label}</strong><p>${c.text}</p></div>
            <strong>${c.value}</strong>
          </article>`
        )
        .join('')}
    </div>
  </section>`;
}

function renderFactorPills() {
  return FACTORS.map((factor) => {
    const active = state.activeFilters.includes(factor.name);
    return `<button class="pill ${active ? 'active' : ''}" data-factor="${factor.name}" onclick="toggleFactor('${factor.name}')">${icon(factor.icon, 14)} ${factor.name}</button>`;
  }).join('');
}

function addIllness() {
  const input = document.getElementById('illness-input');
  const value = (input?.value ?? state.illnessDraft).trim();
  if (!value) return;
  if (!state.illnesses.includes(value)) state.illnesses.push(value);
  if (input) input.value = '';
  state.illnessDraft = '';
  state.onboardingError = '';
  saveState();
  render();
}

function removeIllness(index) {
  state.illnesses.splice(index, 1);
  saveState();
  render();
}

async function onSelectCommonIllness(illness) {
  if (!illness) return;
  if (!state.illnesses.includes(illness)) state.illnesses.push(illness);
  state.userProfile.selectedIllness = illness;
  state.onboardingLoading = true;
  state.onboardingError = '';
  const reqId = Date.now();
  state.onboardingRequestId = reqId;
  saveState();
  render();

  try {
    const factors = await inferTriggersFromIllnessApi(illness);
    if (state.onboardingRequestId !== reqId) return;
    autoSelectFactors(factors);
    state.autoTriggerSuggestions = factors;
  } catch {
    if (state.onboardingRequestId !== reqId) return;
    const fallback = FALLBACK_ILLNESS_TRIGGER_MAP[illness] || [];
    autoSelectFactors(fallback);
    state.autoTriggerSuggestions = fallback;
    state.onboardingError = 'Could not fetch full illness data. Used trusted fallback factors.';
  } finally {
    if (state.onboardingRequestId === reqId) {
      state.onboardingLoading = false;
    }
  }

  saveState();
  render();
}

function goToOnboardingStep1() {
  state.onboardingStep = 1;
  render();
}

function goToOnboardingStep2() {
  state.onboardingStep = 2;
  render();
}

function addTrigger() {
  const input = document.getElementById('trigger-input');
  const value = (input?.value ?? state.triggerDraft).trim();
  if (!value) return;
  if (!state.triggers.includes(value)) state.triggers.push(value);
  if (input) input.value = '';
  state.triggerDraft = '';
  saveState();
  render();
}

function removeTrigger(index) {
  state.triggers.splice(index, 1);
  saveState();
  render();
}

function finishOnboarding() {
  saveState();
  state.currentView = 'app';
  state.appTab = 'map';
  render();
}

function toggleFactor(name) {
  if (state.activeFilters.includes(name)) {
    state.activeFilters = state.activeFilters.filter((f) => f !== name);
  } else {
    state.activeFilters.push(name);
  }
  saveState();

  if (state.currentView === 'onboarding') {
    updateFactorPillsInDOM();
    return;
  }

  if (state.appTab === 'map' && map) {
    drawMapOverlays();
    updateFactorPillsInDOM();
  } else {
    render();
  }
}

function updateFactorPillsInDOM() {
  document.querySelectorAll('.pill[data-factor]').forEach((pill) => {
    const factor = pill.dataset.factor;
    pill.classList.toggle('active', state.activeFilters.includes(factor));
  });
}

function getFilteredEvents() {
  let out = [...state.events];
  const q = state.logSearch.trim().toLowerCase();
  if (q) {
    out = out.filter((ev) =>
      [ev.trigger, ev.factor, ev.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  if (state.logFilter !== 'All') out = out.filter((ev) => ev.factor === state.logFilter);
  out.sort((a, b) => (state.logSort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));
  return out;
}

function deleteEvent(id) {
  state.events = state.events.filter((ev) => ev.id !== id);
  saveState();
  render();
}

function buildMockFactorData(lat, lng) {
  const arr = [];
  FACTORS.forEach((factor) => {
    for (let i = 0; i < 4; i++) {
      arr.push({
        factor: factor.name,
        color: factor.color,
        lat: lat + (Math.random() - 0.5) * 0.08,
        lng: lng + (Math.random() - 0.5) * 0.08,
        value: Math.round(Math.random() * 55 + 35),
      });
    }
  });
  return arr;
}

function initMapView() {
  setTimeout(async () => {
    if (map) {
      map.off();
      map.remove();
      map = null;
    }

    if (locationWatchId != null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    map = L.map('map', { zoomControl: false }).setView([BOSTON.lat, BOSTON.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (ev) => openMapClickEventModal(ev.latlng));

    state.mapData = buildMockFactorData(BOSTON.lat, BOSTON.lng);

    try {
      await Promise.all([fetchWeather(), fetchRealtimeAreaEventsHeat()]);
    } catch {}

    drawMapOverlays();
    setTimeout(() => map?.invalidateSize(), 150);
    await centerOnCurrentLocation(true);
    ensureLiveLocationWatch();

    if (!state.mapHintShown) {
      showToast('Tip: Tap anywhere on the map to add an event in that location.', 3500);
      state.mapHintShown = true;
      saveState();
    }
  }, 0);
}

function drawMapOverlays() {
  if (!map) return;

  markerLayer.forEach((m) => map.removeLayer(m));
  markerLayer = [];

  state.mapData.forEach((point) => {
    if (!state.activeFilters.includes(point.factor)) return;
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 9,
      color: '#fff',
      weight: 1.5,
      fillColor: point.color,
      fillOpacity: 0.78,
      className: 'map-factor-marker',
    })
      .bindPopup(`<strong>${point.factor}</strong><br>Intensity: ${point.value}`)
      .addTo(map);
    markerLayer.push(marker);
  });

  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const heatPoints = state.mapData
    .filter((point) => state.activeFilters.includes(point.factor))
    .map((point) => [point.lat, point.lng, Math.min(1, point.value / 100)]);

  if (heatPoints.length) {
    heatLayer = L.heatLayer(heatPoints, {
      radius: 26,
      blur: 22,
      maxZoom: 15,
      gradient: {
        0.2: '#6d28d9',
        0.45: '#3b82f6',
        0.7: '#f97316',
        1.0: '#ef4444',
      },
    }).addTo(map);
  }
}

async function searchLocation() {
  const input = document.getElementById('map-search');
  const query = input?.value.trim();
  if (!query || !map) return;

  state.searchLocationText = query;
  saveState();

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      showToast('No destination match found. Try another search term.', 2600);
      return;
    }
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);

    state.destinationLocation = { lat, lng, label: data[0].display_name || query };

    map.setView([lat, lng], 13);
    state.mapData = buildMockFactorData(lat, lng);
    await fetchRealtimeAreaEventsHeat(lat, lng);
    drawMapOverlays();
    drawNavigationOverlays();
    updateRoutePreviewUI();
  } catch {
    showToast('Location search failed. Please try another query.', 3000);
  }
}

function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
      ...options,
    });
  });
}

async function centerOnCurrentLocation(silent = false) {
  try {
    const position = await getCurrentLocation();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    state.currentLocation = { lat, lng };
    state.locationError = '';

    if (map) {
      map.setView([lat, lng], 14);
      drawNavigationOverlays();
      if (!silent) showToast('Centered on your current location.', 2200);
    }
  } catch (error) {
    state.locationError = error?.message || 'Unable to access current location.';
    if (!silent) showToast('Location permission is required to navigate from your current position.', 3200);
  }
}

function ensureLiveLocationWatch() {
  if (!navigator.geolocation || locationWatchId != null) return;

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      state.currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      state.locationError = '';
      drawNavigationOverlays();
    },
    (error) => {
      state.locationError = error?.message || 'Live location tracking unavailable.';
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    }
  );
}

function drawNavigationOverlays() {
  if (!map) return;

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }
  if (destinationMarker) {
    map.removeLayer(destinationMarker);
    destinationMarker = null;
  }

  if (state.currentLocation) {
    userLocationMarker = L.circleMarker([state.currentLocation.lat, state.currentLocation.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: '#22d3ee',
      fillOpacity: 0.95,
    })
      .bindPopup('<strong>Your location</strong>')
      .addTo(map);
  }

  if (state.destinationLocation) {
    destinationMarker = L.marker([state.destinationLocation.lat, state.destinationLocation.lng])
      .bindPopup(`<strong>Destination</strong><br>${escapeHtml(state.destinationLocation.label || 'Selected destination')}`)
      .addTo(map);
  }
}

async function startNavigation() {
  if (!state.currentLocation) {
    await centerOnCurrentLocation();
  }

  if (!state.destinationLocation) {
    const query = document.getElementById('map-search')?.value?.trim();
    if (!query) {
      showToast('Search for a destination first, then tap Navigate.', 3000);
      return;
    }
    await searchLocation();
  }

  if (!state.currentLocation || !state.destinationLocation) {
    showToast('Navigation is not ready yet. Check location permission and destination.', 3000);
    return;
  }

  await fetchRouteFromCurrentLocation();
}

async function fetchRouteFromCurrentLocation() {
  const from = state.currentLocation;
  const to = state.destinationLocation;
  if (!from || !to || !map) return;

  const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Route lookup failed');
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('No route found');

    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    if (routePolyline) {
      map.removeLayer(routePolyline);
      routePolyline = null;
    }

    routePolyline = L.polyline(latlngs, {
      color: '#a78bfa',
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [22, 22] });

    state.routeInfo = {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
    updateRoutePreviewUI();
    showToast(`Route ready: ${state.routeInfo.distanceKm.toFixed(1)} km · ${Math.round(state.routeInfo.durationMin)} min`, 3500);
  } catch (error) {
    state.routeInfo = null;
    state.locationError = error?.message || 'Unable to build route.';
    updateRoutePreviewUI();
    showToast(state.locationError, 3200);
  }
}

function openMapClickEventModal(latlng) {
  pendingMapClick = latlng;
  const overlay = document.createElement('div');
  overlay.className = 'overlay event-overlay';
  overlay.innerHTML = `<div class="modal">
    <h3>Add New Event</h3>
    <div class="coords">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
    <input id="event-trigger" class="input" placeholder="Trigger (e.g., Loud Noise)">
    <select id="event-factor" class="input">
      <option value="">Choose factor (optional)</option>
      ${FACTORS.map((f) => `<option>${f.name}</option>`).join('')}
    </select>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeEventModal()">Cancel</button>
      <button class="btn primary" onclick="submitMapEvent()">Add Event</button>
    </div>
  </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEventModal();
  });

  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('event-trigger')?.focus(), 30);
}

function closeEventModal() {
  document.querySelector('.event-overlay')?.remove();
  pendingMapClick = null;
}

function submitMapEvent() {
  if (!pendingMapClick) return;
  const trigger = document.getElementById('event-trigger')?.value.trim();
  const factor = document.getElementById('event-factor')?.value || '';
  if (!trigger) return;

  const event = {
    id: crypto.randomUUID(),
    trigger,
    factor,
    lat: pendingMapClick.lat,
    lng: pendingMapClick.lng,
    timestamp: Date.now(),
  };

  state.events.unshift(event);

  if (factor) {
    const factorMeta = FACTORS.find((f) => f.name === factor);
    state.mapData.push({
      factor,
      color: factorMeta?.color || '#8b5cf6',
      lat: pendingMapClick.lat,
      lng: pendingMapClick.lng,
      value: 92,
      userEvent: true,
    });
    if (!state.activeFilters.includes(factor)) state.activeFilters.push(factor);
  }

  saveState();
  closeEventModal();
  drawMapOverlays();
}

async function fetchWeather() {
  state.weatherStatus = 'loading';
  state.weatherError = '';
  if (state.appTab === 'conditions') renderMain();

  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.36&longitude=-71.06&current_weather=true');
    if (!res.ok) throw new Error('Weather API request failed.');
    const data = await res.json();
    console.log('Open-Meteo response:', data);

    const current = data.current_weather;
    state.weather = {
      temperature: current?.temperature,
      windspeed: current?.windspeed,
      time: current?.time,
    };
    state.weatherStatus = 'success';

    if (state.mapData.length && Number.isFinite(state.weather.temperature)) {
      state.mapData = state.mapData.map((p) =>
        p.factor === 'Temperature' ? { ...p, value: Math.round((state.weather.temperature + 20) * 2.2) } : p
      );
    }
  } catch (err) {
    state.weatherStatus = 'error';
    state.weatherError = err?.message || 'Failed to load weather data.';
  }

  if (state.appTab === 'conditions') renderMain();
}

async function fetchRealtimeAreaEventsHeat(lat = BOSTON.lat, lng = BOSTON.lng) {
  state.eventFeedStatus = 'loading';
  state.eventFeedError = '';

  const box = {
    minLat: lat - 0.35,
    maxLat: lat + 0.35,
    minLng: lng - 0.55,
    maxLng: lng + 0.55,
  };

  const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate}&minlatitude=${box.minLat}&maxlatitude=${box.maxLat}&minlongitude=${box.minLng}&maxlongitude=${box.maxLng}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Event feed API failed.');
    const data = await res.json();

    const features = Array.isArray(data.features) ? data.features : [];

    const realtimePoints = features
      .map((f) => {
        const coords = f.geometry?.coordinates;
        const mag = Number(f.properties?.mag || 1);
        if (!coords || coords.length < 2) return null;
        return {
          factor: 'Crowds',
          color: '#3b82f6',
          lat: Number(coords[1]),
          lng: Number(coords[0]),
          value: Math.max(20, Math.min(98, Math.round(mag * 22 + 30))),
          source: 'USGS realtime events',
        };
      })
      .filter(Boolean);

    state.mapData = state.mapData.filter((p) => p.source !== 'USGS realtime events');

    if (realtimePoints.length) {
      state.mapData.push(...realtimePoints);
    } else {
      state.mapData.push(
        {
          factor: 'Crowds',
          color: '#3b82f6',
          lat: lat + 0.03,
          lng: lng - 0.02,
          value: 55,
          source: 'USGS realtime events',
        },
        {
          factor: 'Crowds',
          color: '#3b82f6',
          lat: lat - 0.04,
          lng: lng + 0.02,
          value: 50,
          source: 'USGS realtime events',
        }
      );
    }

    state.eventFeedStatus = 'success';
  } catch (err) {
    state.eventFeedStatus = 'error';
    state.eventFeedError = err?.message || 'Failed to load realtime events.';
  }
}

async function inferTriggersFromIllnessApi(illness) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(illness)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Illness lookup failed');
  const data = await res.json();
  const text = `${data.extract || ''}`.toLowerCase();

  const keywordToFactor = [
    { words: ['noise', 'sound', 'loud'], factor: 'Noise' },
    { words: ['light', 'photophobia', 'visual', 'brightness'], factor: 'Light' },
    { words: ['chemical', 'odor', 'smell', 'fragrance', 'smoke'], factor: 'Chemicals' },
    { words: ['crowd', 'social stress', 'overstimulation'], factor: 'Crowds' },
    { words: ['uv', 'sun', 'sunlight'], factor: 'UV' },
    { words: ['air', 'respiratory', 'pollution', 'lung'], factor: 'Air Quality' },
    { words: ['heat', 'cold', 'temperature'], factor: 'Temperature' },
    { words: ['pollen', 'allergy', 'allergic'], factor: 'Pollen' },
  ];

  const detected = new Set();
  keywordToFactor.forEach((entry) => {
    if (entry.words.some((w) => text.includes(w))) detected.add(entry.factor);
  });

  if (!detected.size) {
    (FALLBACK_ILLNESS_TRIGGER_MAP[illness] || []).forEach((f) => detected.add(f));
  }

  return Array.from(detected);
}

function autoSelectFactors(factors) {
  factors.forEach((factor) => {
    if (!state.activeFilters.includes(factor)) state.activeFilters.push(factor);
    if (!state.triggers.includes(factor)) state.triggers.push(factor);
  });
}

function randomMetric(seed) {
  const base = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return Math.round((base + Date.now() / 1000) % 40 + 55);
}

function icon(name, size = 16) {
  return `<i data-lucide="${name}" data-size="${size}"></i>`;
}

function refreshIcons() {
  if (!window.lucide?.createIcons) return;
  window.lucide.createIcons({
    attrs: {
      width: '1em',
      height: '1em',
      'stroke-width': '2',
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

loadState();
loadAuthSession();
render();

window.navigate = navigate;
window.beginExperience = beginExperience;
window.setTab = setTab;
window.setAuthMode = setAuthMode;
window.submitAuth = submitAuth;
window.addIllness = addIllness;
window.removeIllness = removeIllness;
window.onSelectCommonIllness = onSelectCommonIllness;
window.goToOnboardingStep2 = goToOnboardingStep2;
window.goToOnboardingStep1 = goToOnboardingStep1;
window.addTrigger = addTrigger;
window.removeTrigger = removeTrigger;
window.finishOnboarding = finishOnboarding;
window.toggleFactor = toggleFactor;
window.searchLocation = searchLocation;
window.centerOnCurrentLocation = centerOnCurrentLocation;
window.startNavigation = startNavigation;
window.openProfileModal = openProfileModal;
window.closeModal = closeModal;
window.logout = logout;
window.closeEventModal = closeEventModal;
window.submitMapEvent = submitMapEvent;
window.deleteEvent = deleteEvent;
window.fetchWeather = fetchWeather;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
