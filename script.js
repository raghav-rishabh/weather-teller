/* ═══════════════════════════════════════════════════════════
   script.js — Stratos Weather App
   Main application logic: search, display, sidebar, events
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   CONFIGURATION
───────────────────────────────────────────────────────── */
/**
 * Replace with your OpenWeatherMap API key.
 * Free tier: https://home.openweathermap.org/api_keys
 * The free "Current Weather Data" API is sufficient.
 */
const OWM_API_KEY = '0d337ffe04ba488057ca7d1409272d5a';
const OWM_BASE    = 'https://api.openweathermap.org/data/2.5';

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
const state = {
  currentCity:    null,   // Currently displayed city name
  currentData:    null,   // Raw weather data object from OWM
  units:          'metric', // 'metric' | 'imperial'
  savedIds:       new Set(), // Set of city names currently saved
};

/* ─────────────────────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {
  searchInput:   $('searchInput'),
  clearBtn:      $('clearBtn'),
  loadingState:  $('loadingState'),
  emptyState:    $('emptyState'),
  weatherCard:   $('weatherCard'),
  errorBanner:   $('errorBanner'),
  errorMessage:  $('errorMessage'),
  errorClose:    $('errorClose'),
  // Weather data
  cityName:      $('cityName'),
  countryName:   $('countryName'),
  temperature:   $('temperature'),
  tempUnit:      $('tempUnit'),
  weatherIcon:   $('weatherIcon'),
  condition:     $('condition'),
  datetime:      $('datetime'),
  feelsLike:     $('feelsLike'),
  humidity:      $('humidity'),
  windSpeed:     $('windSpeed'),
  visibility:    $('visibility'),
  pressure:      $('pressure'),
  sunrise:       $('sunrise'),
  uvIndex:       $('uvIndex'),
  cloudCover:    $('cloudCover'),
  uvBar:         $('uvBar'),
  cloudBar:      $('cloudBar'),
  // Actions
  saveBtn:       $('saveBtn'),
  refreshBtn:    $('refreshBtn'),
  // Unit toggles
  unitC:         $('unitC'),
  unitF:         $('unitF'),
  // Sidebar
  sidebar:       $('sidebar'),
  sidebarClose:  $('sidebarClose'),
  sidebarOverlay:$('sidebarOverlay'),
  menuBtn:       $('menuBtn'),
  savedList:     $('savedList'),
  recentList:    $('recentList'),
};

/* ─────────────────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────────────────── */

/**
 * Format a UNIX timestamp as a human-readable date/time string.
 * @param {number} unix - UNIX timestamp in seconds
 * @param {number} timezoneOffset - OWM timezone offset in seconds
 * @returns {string}
 */
function formatDateTime(unix, timezoneOffset) {
  const date = new Date((unix + timezoneOffset) * 1000);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    timeZone: 'UTC',
  });
}

/**
 * Format a UNIX timestamp as HH:MM (for sunrise/sunset).
 * @param {number} unix
 * @param {number} timezoneOffset
 * @returns {string}
 */
function formatTime(unix, timezoneOffset) {
  const date = new Date((unix + timezoneOffset) * 1000);
  return date.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/**
 * Build the full OWM weather icon URL.
 * Uses @2x for higher resolution.
 * @param {string} iconCode
 * @returns {string}
 */
function iconUrl(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

/**
 * Return wind speed string with appropriate unit label.
 * @param {number} speed - m/s (metric) or mph (imperial)
 * @returns {string}
 */
function windLabel(speed) {
  return state.units === 'metric'
    ? `${Math.round(speed)} m/s`
    : `${Math.round(speed)} mph`;
}

/**
 * Return temperature string with unit symbol.
 * @param {number} temp
 * @returns {string}
 */
function tempLabel(temp) {
  return `${Math.round(temp)}°${state.units === 'metric' ? 'C' : 'F'}`;
}

/**
 * Convert visibility from metres to a readable string.
 * OWM returns visibility in metres (max 10000).
 * @param {number} vis
 * @returns {string}
 */
function visibilityLabel(vis) {
  if (vis >= 1000) return `${(vis / 1000).toFixed(1)} km`;
  return `${vis} m`;
}

/**
 * Clamp a value between min and max.
 */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/* ─────────────────────────────────────────────────────────
   WEATHER API
───────────────────────────────────────────────────────── */

/**
 * Fetch current weather data from OpenWeatherMap.
 * @param {string} city - City name (e.g. "London")
 * @param {string} units - 'metric' | 'imperial'
 * @returns {Promise<object>} - OWM response JSON
 * @throws {Error} - If city not found or network error
 */
async function fetchWeather(city, units = 'metric') {
  const url = new URL(`${OWM_BASE}/weather`);
  url.searchParams.set('q',       city);
  url.searchParams.set('appid',   OWM_API_KEY);
  url.searchParams.set('units',   units);

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 404) throw new Error(`City "${city}" not found.`);
    if (response.status === 401) throw new Error('Invalid API key. Check your OpenWeatherMap credentials.');
    throw new Error(`Weather fetch failed (${response.status}).`);
  }

  return response.json();
}

/* ─────────────────────────────────────────────────────────
   UI — SHOW / HIDE
───────────────────────────────────────────────────────── */

/** Show loading spinner, hide card and empty state. */
function showLoading() {
  dom.loadingState.hidden  = false;
  dom.weatherCard.hidden   = true;
  dom.emptyState.hidden    = true;
  dom.errorBanner.hidden   = true;
}

/** Show empty/welcome state. */
function showEmpty() {
  dom.emptyState.hidden    = false;
  dom.loadingState.hidden  = true;
  dom.weatherCard.hidden   = true;
}

/** Show the weather card, hide others. */
function showCard() {
  dom.weatherCard.hidden  = false;
  dom.loadingState.hidden = true;
  dom.emptyState.hidden   = true;
}

/**
 * Show an error banner with the given message.
 * Auto-hides after 5 seconds.
 * @param {string} message
 */
function showError(message) {
  dom.errorMessage.textContent = message;
  dom.errorBanner.hidden       = false;
  dom.loadingState.hidden      = true;

  clearTimeout(showError._timer);
  showError._timer = setTimeout(() => {
    dom.errorBanner.hidden = true;
  }, 5000);
}

/* ─────────────────────────────────────────────────────────
   UI — POPULATE WEATHER CARD
───────────────────────────────────────────────────────── */

/**
 * Populate all weather card fields from OWM data.
 * @param {object} data - Raw OWM current weather response
 */
function populateWeatherCard(data) {
  const tz = data.timezone; // offset in seconds

  // Location
  dom.cityName.textContent    = data.name;
  dom.countryName.textContent = `${data.sys.country} · Lat ${data.coord.lat.toFixed(2)}, Lon ${data.coord.lon.toFixed(2)}`;

  // Temperature
  dom.temperature.textContent = Math.round(data.main.temp);
  dom.tempUnit.textContent    = state.units === 'metric' ? '°C' : '°F';

  // Icon & Condition
  const iconCode = data.weather[0].icon;
  dom.weatherIcon.src         = iconUrl(iconCode);
  dom.weatherIcon.alt         = data.weather[0].description;
  dom.condition.textContent   = data.weather[0].description;

  // Date/Time
  dom.datetime.textContent    = formatDateTime(data.dt, tz);

  // Stats
  dom.feelsLike.textContent   = tempLabel(data.main.feels_like);
  dom.humidity.textContent    = `${data.main.humidity}%`;
  dom.windSpeed.textContent   = windLabel(data.wind.speed);
  dom.visibility.textContent  = visibilityLabel(data.visibility);
  dom.pressure.textContent    = `${data.main.pressure} hPa`;
  dom.sunrise.textContent     = formatTime(data.sys.sunrise, tz);

  // Cloud cover bar
  const clouds = data.clouds.all; // %
  dom.cloudCover.textContent  = `${clouds}%`;
  dom.cloudBar.style.width    = `${clamp(clouds, 0, 100)}%`;

  // UV Index — not in basic endpoint; we'll use cloud cover as proxy
  // In a full implementation, use the One Call API for UV data.
  // For now, derive a rough display value from weather condition.
  const uvProxy = deriveUvProxy(data);
  dom.uvIndex.textContent = uvProxy.label;
  dom.uvBar.style.width   = `${uvProxy.pct}%`;

  // Save button state
  updateSaveButton(data.name);
}

/**
 * Derive a rough UV proxy label & percentage from weather condition.
 * This is a UX fallback; for real UV use the OWM One Call API.
 * @param {object} data
 * @returns {{ label: string, pct: number }}
 */
function deriveUvProxy(data) {
  const id = data.weather[0].id;
  // 800 = clear sky, 80x = clouds, 7xx = atmosphere, 6xx = snow, etc.
  if (id === 800) return { label: 'High (8)',    pct: 80 };
  if (id === 801) return { label: 'Moderate (5)', pct: 50 };
  if (id === 802) return { label: 'Low (3)',      pct: 30 };
  if (id >= 803)  return { label: 'Low (2)',      pct: 20 };
  if (id >= 700)  return { label: 'Low (1)',      pct: 10 };
  return            { label: 'Minimal (0)',   pct: 5 };
}

/* ─────────────────────────────────────────────────────────
   SEARCH FLOW
───────────────────────────────────────────────────────── */

/**
 * Main search handler. Fetches weather, updates UI & DB.
 * @param {string} city
 */
async function handleSearch(city) {
  city = city.trim();
  if (!city) return;

  showLoading();

  try {
    const data = await fetchWeather(city, state.units);

    // Store in state
    state.currentCity = data.name;
    state.currentData = data;

    // Update UI
    populateWeatherCard(data);
    showCard();

//     sessionStorage.setItem(
//   'lastWeather',
//   JSON.stringify(data)
// );
sessionStorage.setItem(
  'lastWeather',
  JSON.stringify({
    data: data,
    timestamp: Date.now()
  })
);

    // Record in recent searches (non-blocking)
    addRecentSearch(data.name).then(() => renderRecentList());

  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
    showEmpty();
  }
}

/**
 * Re-fetch weather for the current city (unit change or refresh).
 */
async function refreshCurrentCity() {
  if (!state.currentCity) return;

  // Spin the refresh button
  dom.refreshBtn.classList.add('spinning');

  try {
    const data = await fetchWeather(state.currentCity, state.units);
    state.currentData = data;
    populateWeatherCard(data);

    // Brief visual feedback
    dom.weatherCard.style.opacity = '0.6';
    setTimeout(() => { dom.weatherCard.style.opacity = '1'; }, 300);
  } catch (err) {
    showError(err.message);
  } finally {
    setTimeout(() => dom.refreshBtn.classList.remove('spinning'), 600);
  }
}

/* ─────────────────────────────────────────────────────────
   SAVE / DELETE LOCATION
───────────────────────────────────────────────────────── */

/** Toggle save state for current city. */
async function handleSaveToggle() {
  if (!state.currentData) return;

  const { name, sys, coord } = state.currentData;

  if (state.savedIds.has(name.toLowerCase())) {
    // Already saved — remove from LS/Supabase
    const saved = await fetchSavedLocations();
    const entry = saved.find((l) => l.city.toLowerCase() === name.toLowerCase());
    if (entry) {
      await deleteSavedLocation(entry.id);
      state.savedIds.delete(name.toLowerCase());
    }
  } else {
    const result = await saveLocation({
      city:    name,
      country: sys.country,
      lat:     coord.lat,
      lon:     coord.lon,
    });

    if (result.success) {
      state.savedIds.add(name.toLowerCase());
    } else if (result.duplicate) {
      showError(`"${name}" is already in your saved locations.`);
      return;
    }
  }

  updateSaveButton(name);
  await renderSavedList();
}

/**
 * Update the bookmark button appearance.
 * @param {string} cityName
 */
function updateSaveButton(cityName) {
  const isSaved = state.savedIds.has(cityName.toLowerCase());
  dom.saveBtn.classList.toggle('is-saved', isSaved);
  dom.saveBtn.setAttribute('title', isSaved ? 'Remove saved location' : 'Save location');
  dom.saveBtn.setAttribute('aria-label', isSaved ? 'Remove saved location' : 'Save location');
  // Swap icon
  dom.saveBtn.innerHTML = isSaved
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3-7 3V5z"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
}

/* ─────────────────────────────────────────────────────────
   SIDEBAR — RENDER LISTS
───────────────────────────────────────────────────────── */

/**
 * Render the saved locations list in the sidebar.
 */
async function renderSavedList() {
  const items = await fetchSavedLocations();

  // Keep state.savedIds in sync
  state.savedIds.clear();
  items.forEach((l) => state.savedIds.add(l.city.toLowerCase()));

  if (items.length === 0) {
    dom.savedList.innerHTML = '<li class="saved-list__empty">No saved locations yet.</li>';
    return;
  }

  dom.savedList.innerHTML = items.map((loc) => `
    <li class="list-item" data-id="${loc.id}" data-city="${loc.city}">
      <span class="list-item__icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </span>
      <span class="list-item__name">${escapeHtml(loc.city)}${loc.country ? `, ${escapeHtml(loc.country)}` : ''}</span>
      <button
        class="list-item__delete"
        aria-label="Remove ${escapeHtml(loc.city)}"
        onclick="removeSaved('${loc.id}', event)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </li>
  `).join('');

  // Click on item body → load city weather
  dom.savedList.querySelectorAll('.list-item').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.list-item__delete')) return;
      const city = li.dataset.city;
      dom.searchInput.value = city;
      toggleClearBtn();
      handleSearch(city);
      closeSidebar();
    });
  });
}

/**
 * Render the recent searches list.
 */
async function renderRecentList() {
  const items = await fetchRecentSearches();

  if (items.length === 0) {
    dom.recentList.innerHTML = '<li class="saved-list__empty">No recent searches yet.</li>';
    return;
  }

  dom.recentList.innerHTML = items.map((r) => `
    <li class="list-item" data-id="${r.id}" data-city="${r.city}">
      <span class="list-item__icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </span>
      <span class="list-item__name">${escapeHtml(r.city)}</span>
      <button
        class="list-item__delete"
        aria-label="Remove ${escapeHtml(r.city)}"
        onclick="removeRecent('${r.id}', event)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </li>
  `).join('');

  dom.recentList.querySelectorAll('.list-item').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.list-item__delete')) return;
      const city = li.dataset.city;
      dom.searchInput.value = city;
      toggleClearBtn();
      handleSearch(city);
      closeSidebar();
    });
  });
}

/* Exposed to onclick in HTML (global scope) */
async function removeSaved(id, e) {
  e.stopPropagation();
  await deleteSavedLocation(id);
  // If it was the current city, update the save button
  if (state.currentCity) updateSaveButton(state.currentCity);
  await renderSavedList();
}

async function removeRecent(id, e) {
  e.stopPropagation();
  await deleteRecentSearch(id);
  await renderRecentList();
}

/* ─────────────────────────────────────────────────────────
   SIDEBAR TOGGLE
───────────────────────────────────────────────────────── */

function openSidebar() {
  dom.sidebar.classList.add('is-open');
  dom.sidebarOverlay.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  dom.sidebar.classList.remove('is-open');
  dom.sidebarOverlay.classList.remove('is-visible');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────────────────
   SEARCH INPUT HELPERS
───────────────────────────────────────────────────────── */

function toggleClearBtn() {
  dom.clearBtn.hidden = dom.searchInput.value.length === 0;
}

/* ─────────────────────────────────────────────────────────
   UNIT TOGGLE
───────────────────────────────────────────────────────── */

function setUnit(unit) {
  state.units = unit;
  dom.unitC.classList.toggle('active', unit === 'metric');
  dom.unitF.classList.toggle('active', unit === 'imperial');
  if (state.currentCity) refreshCurrentCity();
}

/* ─────────────────────────────────────────────────────────
   SECURITY: HTML Escape
───────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ─────────────────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────────────────── */

function attachEventListeners() {
  // Search on Enter key
  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch(dom.searchInput.value);
  });

  // Show/hide clear button
  dom.searchInput.addEventListener('input', toggleClearBtn);

  // Clear button
  dom.clearBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.searchInput.focus();
    toggleClearBtn();
  });

  // Error banner close
  dom.errorClose.addEventListener('click', () => {
    dom.errorBanner.hidden = true;
  });

  // Save button
  dom.saveBtn.addEventListener('click', handleSaveToggle);

  // Refresh button
  dom.refreshBtn.addEventListener('click', refreshCurrentCity);

  // Unit toggle
  dom.unitC.addEventListener('click', () => setUnit('metric'));
  dom.unitF.addEventListener('click', () => setUnit('imperial'));

  // Sidebar
  dom.menuBtn.addEventListener('click', openSidebar);
  dom.sidebarClose.addEventListener('click', closeSidebar);
  dom.sidebarOverlay.addEventListener('click', closeSidebar);

  // Allow keyboard users to dismiss sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
}

/* ─────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────── */

async function init() {
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Attach all event listeners
  attachEventListeners();

  // Show welcome state initially
  // showEmpty();



//   const savedWeather = sessionStorage.getItem('lastWeather');

// if (savedWeather) {
//   const parsedWeather = JSON.parse(savedWeather);

//   state.currentCity = parsedWeather.name;
//   state.currentData = parsedWeather;

//   dom.searchInput.value = parsedWeather.name;
// toggleClearBtn();

//   populateWeatherCard(parsedWeather);
//   showCard();
// } else {
//   showEmpty();
// }

const savedWeather = sessionStorage.getItem('lastWeather');

if (savedWeather) {
  const parsedWeather = JSON.parse(savedWeather);

  const ONE_HOUR = 60 * 60 * 1000;

  // Check if expired
  if (Date.now() - parsedWeather.timestamp > ONE_HOUR) {

    // Remove expired data
    sessionStorage.removeItem('lastWeather');

    showEmpty();

  } else {

    // Use saved weather
    state.currentCity = parsedWeather.data.name;
    state.currentData = parsedWeather.data;

    dom.searchInput.value = parsedWeather.data.name;

    toggleClearBtn();

    populateWeatherCard(parsedWeather.data);

    showCard();
  }

} else {
  showEmpty();
}




  // Load sidebar data from Supabase / sessionStorage
  await Promise.all([renderSavedList(), renderRecentList()]);

  // Auto-focus the search input on desktop
  if (window.innerWidth > 768) {
    dom.searchInput.focus();
  }


}

// Kick off the app
document.addEventListener('DOMContentLoaded', init);
