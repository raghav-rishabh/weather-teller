/* ═══════════════════════════════════════════════════════════
   supabase.js — Supabase client + DB operations
   ═══════════════════════════════════════════════════════════

   SETUP INSTRUCTIONS:
   1. Go to https://supabase.com and create a free project
   2. In SQL Editor, run the schema below (also in SETUP.md)
   3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
   4. Enable Row Level Security as shown in SETUP.md

   SQL SCHEMA (run in Supabase SQL Editor):
   ─────────────────────────────────────────
   -- Saved locations table
   CREATE TABLE IF NOT EXISTS saved_locations (
     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     city        TEXT NOT NULL,
     country     TEXT,
     lat         FLOAT,
     lon         FLOAT,
     created_at  TIMESTAMPTZ DEFAULT NOW()
   );

   -- Recent searches table
   CREATE TABLE IF NOT EXISTS recent_searches (
     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     city        TEXT NOT NULL UNIQUE,
     searched_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Optional: enable RLS (Row Level Security) for production
   -- ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
   -- ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;
   ─────────────────────────────────────────
*/

/**
 * ════════════════════════════════════════
 *  CONFIGURATION — Replace these values
 * ════════════════════════════════════════
 */
const SUPABASE_URL      = 'https://fwhexperovsdiepgvtlu.supabase.co';       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGV4cGVyb3ZzZGllcGd2dGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjYzMjgsImV4cCI6MjA5NTQwMjMyOH0.u8SZZTXNQuJVZUrQdSI7j-03fmV5CtFO5zW3xUzTSA8';  // from Project Settings > API

/**
 * Initialize the Supabase client.
 * The supabase-js library is loaded via CDN in index.html.
 */
let supabaseClient = null;

// try {
//   if (
//     SUPABASE_URL !== 'https://fwhexperovsdiepgvtlu.supabase.co' &&
//     SUPABASE_ANON_KEY !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGV4cGVyb3ZzZGllcGd2dGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjYzMjgsImV4cCI6MjA5NTQwMjMyOH0.u8SZZTXNQuJVZUrQdSI7j-03fmV5CtFO5zW3xUzTSA8'
//   ) {
//     supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//     console.info('[Supabase] ✅ Client initialized.');
//   } else {
//     console.warn('[Supabase] ⚠️ Credentials not set. Falling back to LocalStorage.');
//   }
// } catch (err) {
//   console.error('[Supabase] ❌ Initialization error:', err);
// }



// try {
//   if (SUPABASE_URL && SUPABASE_ANON_KEY) {

//     supabaseClient = supabase.createClient(
//       SUPABASE_URL,
//       SUPABASE_ANON_KEY
//     );

//     console.info('[Supabase] ✅ Client initialized.');

//   } else {

//     console.warn(
//       '[Supabase] ⚠️ Credentials missing. Falling back to LocalStorage.'
//     );

//   }
// } catch (err) {

//   console.error(
//     '[Supabase] ❌ Initialization error:',
//     err
//   );

// }




/** Whether we have a live Supabase connection. */
const isSupabaseReady = () => supabaseClient !== null;

/* ═══════════════════════════════════════════════════════════
   LOCAL STORAGE FALLBACK HELPERS
   Used when Supabase is not configured or unreachable.
═══════════════════════════════════════════════════════════ */
const LS_SAVED   = 'stratos_saved_locations';
const LS_RECENT  = 'stratos_recent_searches';

/**
 * Read JSON array from localStorage key.
 * @param {string} key
 * @returns {Array}
 */
function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

/**
 * Write JSON array to localStorage key.
 * @param {string} key
 * @param {Array} data
 */
function lsSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ═══════════════════════════════════════════════════════════
   SAVED LOCATIONS — Public API
═══════════════════════════════════════════════════════════ */

/**
 * Fetch all saved locations.
 * @returns {Promise<Array<{id, city, country, lat, lon}>>}
 */
async function fetchSavedLocations() {
  if (!isSupabaseReady()) {
    return lsGet(LS_SAVED);
  }

  try {
    const { data, error } = await supabaseClient
      .from('saved_locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[Supabase] fetchSavedLocations error:', err);
    // Fallback
    return lsGet(LS_SAVED);
  }
}

/**
 * Save a new location.
 * Prevents duplicates by checking existing entries first.
 * @param {{ city: string, country: string, lat: number, lon: number }} location
 * @returns {Promise<{success: boolean, duplicate?: boolean, data?: object}>}
 */
async function saveLocation({ city, country, lat, lon }) {
  const normalizedCity = city.trim();

  if (!isSupabaseReady()) {
    const existing = lsGet(LS_SAVED);
    const isDup = existing.some(
      (l) => l.city.toLowerCase() === normalizedCity.toLowerCase()
    );
    if (isDup) return { success: false, duplicate: true };

    const newEntry = {
      id:         crypto.randomUUID(),
      city:       normalizedCity,
      country:    country || '',
      lat:        lat || null,
      lon:        lon || null,
      created_at: new Date().toISOString(),
    };
    lsSet(LS_SAVED, [newEntry, ...existing]);
    return { success: true, data: newEntry };
  }

  try {
    // Check for duplicate
    const { data: existing } = await supabaseClient
      .from('saved_locations')
      .select('id')
      .ilike('city', normalizedCity)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, duplicate: true };
    }

    const { data, error } = await supabaseClient
      .from('saved_locations')
      .insert([{ city: normalizedCity, country, lat, lon }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] saveLocation error:', err);
    // Fallback to LS
    const existing = lsGet(LS_SAVED);
    const newEntry = { id: crypto.randomUUID(), city: normalizedCity, country, lat, lon };
    lsSet(LS_SAVED, [newEntry, ...existing]);
    return { success: true, data: newEntry };
  }
}

/**
 * Delete a saved location by its ID.
 * @param {string} id
 * @returns {Promise<{success: boolean}>}
 */
async function deleteSavedLocation(id) {
  if (!isSupabaseReady()) {
    const existing = lsGet(LS_SAVED).filter((l) => l.id !== id);
    lsSet(LS_SAVED, existing);
    return { success: true };
  }

  try {
    const { error } = await supabaseClient
      .from('saved_locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Supabase] deleteSavedLocation error:', err);
    // Fallback
    const existing = lsGet(LS_SAVED).filter((l) => l.id !== id);
    lsSet(LS_SAVED, existing);
    return { success: true };
  }
}

/* ═══════════════════════════════════════════════════════════
   RECENT SEARCHES — Public API
═══════════════════════════════════════════════════════════ */

/** Max number of recent searches to store */
const MAX_RECENT = 8;

/**
 * Fetch recent searches ordered by most recent.
 * @returns {Promise<Array<{id, city, searched_at}>>}
 */
async function fetchRecentSearches() {
  if (!isSupabaseReady()) {
    return lsGet(LS_RECENT).slice(0, MAX_RECENT);
  }

  try {
    const { data, error } = await supabaseClient
      .from('recent_searches')
      .select('*')
      .order('searched_at', { ascending: false })
      .limit(MAX_RECENT);

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('[Supabase] fetchRecentSearches error:', err);
    return lsGet(LS_RECENT).slice(0, MAX_RECENT);
  }
}

/**
 * Upsert (add or update) a city in recent searches.
 * Updates the timestamp if it already exists.
 * @param {string} city
 * @returns {Promise<void>}
 */
async function addRecentSearch(city) {
  const normalizedCity = city.trim();

  if (!isSupabaseReady()) {
    let existing = lsGet(LS_RECENT).filter(
      (r) => r.city.toLowerCase() !== normalizedCity.toLowerCase()
    );
    existing = [
      { id: crypto.randomUUID(), city: normalizedCity, searched_at: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_RECENT);
    lsSet(LS_RECENT, existing);
    return;
  }

  try {
    // Upsert: if city exists, update searched_at; else insert
    const { error } = await supabaseClient
      .from('recent_searches')
      .upsert(
        [{ city: normalizedCity, searched_at: new Date().toISOString() }],
        { onConflict: 'city' }
      );

    if (error) throw error;

    // Prune: keep only the latest MAX_RECENT
    const { data: all } = await supabaseClient
      .from('recent_searches')
      .select('id, searched_at')
      .order('searched_at', { ascending: false });

    if (all && all.length > MAX_RECENT) {
      const toDelete = all.slice(MAX_RECENT).map((r) => r.id);
      await supabaseClient.from('recent_searches').delete().in('id', toDelete);
    }
  } catch (err) {
    console.error('[Supabase] addRecentSearch error:', err);
    // Fallback
    let existing = lsGet(LS_RECENT).filter(
      (r) => r.city.toLowerCase() !== normalizedCity.toLowerCase()
    );
    existing = [
      { id: crypto.randomUUID(), city: normalizedCity, searched_at: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_RECENT);
    lsSet(LS_RECENT, existing);
  }
}

/**
 * Delete a single recent search entry by ID.
 * @param {string} id
 * @returns {Promise<{success: boolean}>}
 */
async function deleteRecentSearch(id) {
  if (!isSupabaseReady()) {
    const existing = lsGet(LS_RECENT).filter((r) => r.id !== id);
    lsSet(LS_RECENT, existing);
    return { success: true };
  }

  try {
    const { error } = await supabaseClient
      .from('recent_searches')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[Supabase] deleteRecentSearch error:', err);
    const existing = lsGet(LS_RECENT).filter((r) => r.id !== id);
    lsSet(LS_RECENT, existing);
    return { success: true };
  }
}
