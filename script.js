/* ===== STATE ===== */
const state = {
  userProfile: {},
  illnesses: [],
  triggers: [],
  events: [],
  activeFilters: ['Noise','Light','Chemicals','Crowds','UV','Air Quality','Temperature','Pollen'],
  mapData: [],
  weather: null,
  currentView: 'landing',
  onboardingStep: 1,
};

const FACTORS = [
  { name: 'Noise', color: '#7c3aed', icon: '🔊' },
  { name: 'Light', color: '#eab308', icon: '💡' },
  { name: 'Chemicals', color: '#ef4444', icon: '☣️' },
  { name: 'Crowds', color: '#3b82f6', icon: '👥' },
  { name: 'UV', color: '#f97316', icon: '☀️' },
  { name: 'Air Quality', color: '#22c55e', icon: '🌿' },
  { name: 'Temperature', color: '#14b8a6', icon: '🌡️' },
  { name: 'Pollen', color: '#ec4899', icon: '🌸' },
];

const BOSTON = { lat: 42.36, lng: -71.06 };

/* ===== PERSISTENCE ===== */
function saveState() {
  localStorage.setItem('hush_state', JSON.stringify({
    illnesses: state.illnesses,
    triggers: state.triggers,
    events: state.events,
    activeFilters: state.activeFilters,
  }));
}
function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem('hush_state'));
    if (d) { Object.assign(state, d); }
  } catch {}
}

/* ===== ROUTER ===== */
let map = null;
let markers = [];

function navigate(view) {
  state.currentView = view;
  render();
}

function render() {
  const app = document.getElementById('app');
  switch (state.currentView) {
    case 'landing': app.innerHTML = landingHTML(); break;
    case 'onboarding': app.innerHTML = onboardingHTML(); break;
    case 'app': app.innerHTML = appShellHTML(); initAppView(); break;
    default: app.innerHTML = landingHTML();
  }
}

/* ===== LANDING ===== */
function landingHTML() {
  return `<div class="landing view">
    <div class="landing-logo">Hush</div>
    <h1>Hush</h1>
    <p>It's not just a tool, it's a lifeline</p>
    <button class="btn-primary" onclick="navigate('onboarding')">Get Started</button>
  </div>`;
}

/* ===== ONBOARDING ===== */
function onboardingHTML() {
  if (state.onboardingStep === 1) {
    return `<div class="onboarding view">
      <h2>Tell us about your invisible illnesses</h2>
      <div class="onboarding-input-row">
        <input id="ob-input" placeholder="e.g., Chronic Fatigue Syndrome" onkeydown="if(event.key==='Enter')addIllness()">
        <button class="btn-add" onclick="addIllness()">+</button>
      </div>
      <div class="tag-list">${state.illnesses.map((t,i)=>`<span class="tag">${t}<button onclick="removeIllness(${i})">×</button></span>`).join('')}</div>
      <button class="btn-next" onclick="state.onboardingStep=2;render()">Next</button>
    </div>`;
  }
  return `<div class="onboarding view">
    <h2>What are your known triggers?</h2>
    <div class="onboarding-input-row">
      <input id="ob-input" placeholder="e.g., Loud noises" onkeydown="if(event.key==='Enter')addTrigger()">
      <button class="btn-add" onclick="addTrigger()">+</button>
    </div>
    <div class="tag-list">${state.triggers.map((t,i)=>`<span class="tag">${t}<button onclick="removeTrigger(${i})">×</button></span>`).join('')}</div>
    <button class="btn-next" onclick="finishOnboarding()">Done</button>
  </div>`;
}

function addIllness() {
  const v = document.getElementById('ob-input').value.trim();
  if (v) { state.illnesses.push(v); saveState(); render(); }
}
function removeIllness(i) { state.illnesses.splice(i,1); saveState(); render(); }
function addTrigger() {
  const v = document.getElementById('ob-input').value.trim();
  if (v) { state.triggers.push(v); saveState(); render(); }
}
function removeTrigger(i) { state.triggers.splice(i,1); saveState(); render(); }
function finishOnboarding() { saveState(); state.currentView = 'app'; state.appTab = 'map'; render(); }

/* ===== APP SHELL ===== */
let appTab = 'map';

function appShellHTML() {
  return `<div class="app-shell">
    <div class="top-header">
      <button class="hdr-btn">☰</button>
      <h1>HUSH</h1>
      <button class="hdr-btn">👤</button>
    </div>
    <div class="main-content" id="main-content"></div>
    <nav class="bottom-nav">
      <button onclick="switchTab('logs')" class="${appTab==='logs'?'active':''}"><span class="nav-icon">📋</span>Logs</button>
      <button onclick="switchTab('map')" class="${appTab==='map'?'active':''}"><span class="nav-icon">🗺️</span>Map</button>
      <button onclick="switchTab('conditions')" class="${appTab==='conditions'?'active':''}"><span class="nav-icon">📊</span>Conditions</button>
    </nav>
  </div>`;
}

function switchTab(tab) { appTab = tab; render(); }

function initAppView() {
  const mc = document.getElementById('main-content');
  switch(appTab) {
    case 'map': mc.innerHTML = mapViewHTML(); initMap(); break;
    case 'logs': mc.innerHTML = logsViewHTML(); break;
    case 'conditions': mc.innerHTML = '<div class="loading">Loading...</div>'; fetchConditions(mc); break;
  }
}

/* ===== MAP VIEW ===== */
function mapViewHTML() {
  return `<div class="map-view view">
    <div class="search-bar">
      <input id="search-input" placeholder="Enter destination" onkeydown="if(event.key==='Enter')searchLocation()">
      <button onclick="searchLocation()">🔍</button>
    </div>
    <div id="map"></div>
    <div class="map-filters">
      <h3>Toggle Map Factors</h3>
      <div class="filter-pills">${FACTORS.map(f=>`<button class="pill${state.activeFilters.includes(f.name)?' active':''}" data-factor="${f.name}" onclick="toggleFilter('${f.name}')">${f.icon} ${f.name}</button>`).join('')}</div>
    </div>
    <button class="fab" onclick="openAddEvent()">+</button>
  </div>`;
}

function generateMockData() {
  if (state.mapData.length) return;
  FACTORS.forEach(f => {
    for (let i = 0; i < 5; i++) {
      state.mapData.push({
        factor: f.name,
        color: f.color,
        lat: BOSTON.lat + (Math.random() - .5) * .06,
        lng: BOSTON.lng + (Math.random() - .5) * .06,
        value: Math.floor(Math.random() * 80 + 20),
      });
    }
  });
}

function initMap() {
  generateMockData();
  setTimeout(() => {
    map = L.map('map').setView([BOSTON.lat, BOSTON.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    renderMarkers();
  }, 50);
}

function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  state.mapData.forEach(d => {
    if (!state.activeFilters.includes(d.factor)) return;
    const m = L.circleMarker([d.lat, d.lng], {
      radius: 14, fillColor: d.color, color: '#fff', weight: 2, fillOpacity: .75,
    }).addTo(map).bindPopup(`<b>${d.factor}</b><br>Value: ${d.value}`);
    markers.push(m);
  });
}

function toggleFilter(name) {
  const i = state.activeFilters.indexOf(name);
  if (i >= 0) state.activeFilters.splice(i, 1); else state.activeFilters.push(name);
  saveState();
  // update pills
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', state.activeFilters.includes(p.dataset.factor));
  });
  renderMarkers();
}

async function searchLocation() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (d.length) map.setView([parseFloat(d[0].lat), parseFloat(d[0].lon)], 14);
  } catch {}
}

/* ===== ADD EVENT MODAL ===== */
function openAddEvent() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <h2>Add New Event</h2>
    <input id="event-input" placeholder="Trigger (e.g., Loud Noise)">
    <button class="btn-next" onclick="saveEvent()">Add Event</button>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('event-input').focus(), 100);
}

function saveEvent() {
  const v = document.getElementById('event-input').value.trim();
  if (!v) return;
  state.events.push({ trigger: v, timestamp: new Date().toISOString() });
  saveState();
  document.querySelector('.modal-overlay').remove();
}

/* ===== LOGS VIEW ===== */
function logsViewHTML() {
  if (!state.events.length) {
    return `<div class="logs-view view"><h2>Logged Events</h2><div class="empty-state">No events logged yet.</div></div>`;
  }
  return `<div class="logs-view view"><h2>Logged Events</h2>${state.events.map((e,i)=>`<div class="event-card">
    <div class="ev-info"><h4>${e.trigger}</h4><span>${new Date(e.timestamp).toLocaleString()}</span></div>
    <button class="btn-del" onclick="deleteEvent(${i})">✕</button>
  </div>`).join('')}</div>`;
}

function deleteEvent(i) { state.events.splice(i,1); saveState(); render(); }

/* ===== CONDITIONS VIEW ===== */
async function fetchConditions(container) {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.36&longitude=-71.06&current_weather=true');
    const d = await r.json();
    console.log('Open-Meteo response:', d);
    state.weather = d.current_weather;
    container.innerHTML = conditionsHTML();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error-msg">Could not load weather data. Please try again.</div>`;
  }
}

function conditionsHTML() {
  const w = state.weather || {};
  const temp = w.temperature ?? '--';
  const wind = w.windspeed ?? '--';
  const score = Math.max(10, Math.min(95, 100 - Math.abs(temp - 20) * 2 - wind));

  const conditions = [
    { name: 'Temperature', icon: '🌡️', bg: '#f0fdfa', val: `${temp}°C`, desc: temp > 30 ? 'High temperatures may cause fatigue.' : temp < 5 ? 'Cold temperatures — dress warmly.' : 'Temperature is comfortable.' },
    { name: 'Noise', icon: '🔊', bg: '#f5f3ff', val: Math.floor(Math.random()*30+50), desc: 'Moderate noise levels in the area.' },
    { name: 'Light', icon: '💡', bg: '#fefce8', val: Math.floor(Math.random()*30+60), desc: 'Light levels are comfortable.' },
    { name: 'Chemicals', icon: '☣️', bg: '#fef2f2', val: Math.floor(Math.random()*20+10), desc: 'Low chemical exposure detected.' },
    { name: 'Wind', icon: '💨', bg: '#f0f9ff', val: `${wind} km/h`, desc: wind > 30 ? 'High wind — may affect wellbeing.' : 'Wind is mild.' },
    { name: 'UV', icon: '☀️', bg: '#fff7ed', val: Math.floor(Math.random()*6+1), desc: 'Remember sunscreen if spending time outdoors.' },
  ];

  return `<div class="conditions-view view">
    <h2>Conditions</h2>
    <div class="loc">Boston, MA</div>
    <div class="score-card">
      <p>Wellbeing Score</p>
      <div class="score">${Math.round(score)}%</div>
      <p>Based on current environmental data</p>
    </div>
    <div class="section-title">Track Interests</div>
    <div class="filter-pills" style="margin-bottom:16px">${FACTORS.map(f=>`<button class="pill${state.activeFilters.includes(f.name)?' active':''}" data-factor="${f.name}" onclick="toggleFilter('${f.name}')">${f.icon} ${f.name}</button>`).join('')}</div>
    <div class="section-title">Current Conditions</div>
    ${conditions.map(c=>`<div class="cond-card">
      <div class="cond-icon" style="background:${c.bg}">${c.icon}</div>
      <div class="cond-body"><h4>${c.name}</h4><div class="val">${c.val}</div><p>${c.desc}</p></div>
    </div>`).join('')}
  </div>`;
}

/* ===== INIT ===== */
loadState();
if (state.illnesses.length || state.triggers.length) {
  state.currentView = 'app';
}
render();
