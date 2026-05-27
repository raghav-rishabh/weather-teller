# 🌩 Stratos Weather App — Setup Guide

A premium dark glassmorphism weather app built with vanilla HTML/CSS/JS,
powered by **OpenWeatherMap** and **Supabase**.

---

## 📂 Project Structure

```
weather-app/
├── index.html      # App shell & semantic markup
├── style.css       # Premium dark glassmorphism UI
├── script.js       # Weather logic, search, events
├── supabase.js     # Supabase client + DB operations
└── SETUP.md        # This file
```

---

## 1️⃣ OpenWeatherMap API Setup

1. Go to **https://home.openweathermap.org/users/sign_up** and create a free account.
2. Navigate to **API Keys** in your dashboard.
3. Copy your default API key (or create a new one).
4. Open `script.js` and replace:
   ```js
   const OWM_API_KEY = '0d337ffe04ba488057ca7d1409272d5a';
   ```
   with your actual key:
   ```js
   const OWM_API_KEY = 'a1b2c3d4e5f6...';
   ```

> **Note:** Free tier includes "Current Weather Data" which is all this app uses.
> New keys may take up to 10 minutes to activate.

---

## 2️⃣ Supabase Setup

### Create Project

1. Go to **https://supabase.com** → **Start your project** (free plan).
2. Click **New Project**, choose a name (e.g. `stratos-weather`), set a DB password, pick a region.
3. Wait ~2 minutes for the project to initialize.

### Run SQL Schema

4. In your Supabase dashboard, click **SQL Editor** → **New query**.
5. Paste and run this schema:

```sql
-- ══════════════════════════════════════
-- Saved Locations
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS saved_locations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city        TEXT NOT NULL,
  country     TEXT,
  lat         FLOAT,
  lon         FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- Recent Searches
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS recent_searches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city        TEXT NOT NULL UNIQUE,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_city ON saved_locations (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_recent_city ON recent_searches (city);
CREATE INDEX IF NOT EXISTS idx_recent_searched_at ON recent_searches (searched_at DESC);
```

### Get Your Credentials

6. Go to **Project Settings** (gear icon) → **API**.
7. Copy:
   - **Project URL** — looks like `https://xyzabc.supabase.co`
   - **anon / public** key — a long JWT string

8. Open `supabase.js` and replace:
   ```js
   const SUPABASE_URL      = 'https://fwhexperovsdiepgvtlu.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGV4cGVyb3ZzZGllcGd2dGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjYzMjgsImV4cCI6MjA5NTQwMjMyOH0.u8SZZTXNQuJVZUrQdSI7j-03fmV5CtFO5zW3xUzTSA8';
   ```
   with your actual values.

### Supabase Column Reference

| Table               | Column       | Type          | Notes                        |
|---------------------|--------------|---------------|------------------------------|
| `saved_locations`   | `id`         | UUID (PK)     | Auto-generated               |
| `saved_locations`   | `city`       | TEXT          | City display name            |
| `saved_locations`   | `country`    | TEXT          | 2-letter country code (e.g. GB) |
| `saved_locations`   | `lat`        | FLOAT         | Latitude coordinate          |
| `saved_locations`   | `lon`        | FLOAT         | Longitude coordinate         |
| `saved_locations`   | `created_at` | TIMESTAMPTZ   | Auto-set on insert           |
| `recent_searches`   | `id`         | UUID (PK)     | Auto-generated               |
| `recent_searches`   | `city`       | TEXT (UNIQUE) | Prevents duplicate entries   |
| `recent_searches`   | `searched_at`| TIMESTAMPTZ   | Updated on each search       |

---

## 3️⃣ LocalStorage Fallback

If you don't configure Supabase (or it's unreachable), the app
automatically falls back to **localStorage**:

| Key                         | Contents               |
|-----------------------------|------------------------|
| `stratos_saved_locations`   | JSON array of saved cities |
| `stratos_recent_searches`   | JSON array of recent searches |

No extra configuration needed — it just works.

---

## 4️⃣ Running Locally

### Option A — Simple file server (recommended)

```bash
# Python 3
cd weather-app
python3 -m http.server 3000
# Open: http://localhost:3000
```

```bash
# Node.js (npx)
cd weather-app
npx serve .
# Open the URL shown in terminal
```

### Option B — VS Code Live Server

Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

---

## 5️⃣ Deployment to Vercel

### Method A — Vercel CLI (recommended)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. In the weather-app folder
cd weather-app
vercel

# 3. Follow prompts:
#    - Link to existing project? → N
#    - Project name? → stratos-weather (or anything)
#    - Directory? → ./  (current folder)
#    - Override settings? → N

# 4. Your app is live at: https://your-project.vercel.app
```

### Method B — Vercel Dashboard (drag & drop)

1. Go to **https://vercel.com** → **Add New → Project**.
2. Drag the entire `weather-app/` folder onto the dashboard.
3. Click **Deploy**. Done in ~30 seconds.

### Method C — GitHub Integration

1. Push your `weather-app/` folder to a GitHub repository.
2. On Vercel, **Import Git Repository** → select your repo.
3. Framework preset: **Other** (it's static HTML).
4. Deploy.

> No build step or configuration file (`vercel.json`) is required — Vercel
> auto-detects static HTML sites.

---

## 🎛 Features Overview

| Feature                   | Implementation                            |
|---------------------------|-------------------------------------------|
| City weather search       | OWM `/weather` endpoint                  |
| Temperature, humidity, wind, feels like | OWM `main` object             |
| Visibility, pressure, sunrise | OWM response fields                   |
| Cloud cover bar           | `clouds.all` percentage                  |
| °C / °F toggle            | Re-fetches with `units=imperial`         |
| Save locations            | Supabase `saved_locations` table         |
| Recent searches           | Supabase `recent_searches` (upsert)      |
| Delete saved / recent     | Supabase `delete` by ID                  |
| LocalStorage fallback     | Automatic when Supabase not configured   |
| Error handling            | Animated error banner, auto-dismiss      |
| Loading state             | Dual-ring spinner animation              |
| Responsive layout         | CSS Flexbox, clamp(), media queries      |
| Glassmorphism UI          | `backdrop-filter: blur()` throughout     |
| Animated orb background   | CSS keyframe animations on pseudo-elements |

---

## 🔐 Security Notes

- The **Supabase `anon` key** is safe to expose in frontend code — it respects Row Level Security (RLS).
- For production, enable **RLS** on both tables and add policies.
- The **OWM API key** is visible in client-side code. For production, proxy requests through a serverless function (Vercel Edge Function or Supabase Edge Function) to keep the key server-side.

### Example: Enable RLS (optional, for production)

```sql
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public, no auth needed for this app)
CREATE POLICY "Allow all" ON saved_locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON recent_searches FOR ALL USING (true) WITH CHECK (true);
```

---

## 🧩 Extending the App

| Feature                   | How to Add                                               |
|---------------------------|----------------------------------------------------------|
| 5-day forecast            | Use OWM `/forecast` endpoint, add a forecast row below   |
| Real UV Index             | Use OWM One Call API 3.0 (requires paid plan or legacy)  |
| Geolocation               | `navigator.geolocation` → `fetchWeatherByCoords(lat,lon)` |
| Dark/light theme toggle   | Toggle a `data-theme` attribute, swap CSS variables      |
| Push notifications        | Service Worker + Web Push API                            |
| PWA (installable)         | Add `manifest.json` + service worker                     |

---

*Built with ❤️ using vanilla HTML/CSS/JS, OpenWeatherMap, and Supabase.*
