// MashupController (ICTPRG538 - Create Mashups).
// Two mashups, each combining data from MORE THAN ONE external service:
//
//   Mashup 1 - Store locator: OpenStreetMap map tiles (via Leaflet) + live
//              weather for each store from the Open-Meteo API + our own
//              store data. Combined in the browser (client-side fetch).
//
//   Mashup 2 - Live international pricing: our book catalogue + exchange
//              rates from the Frankfurter API, cross-checked against a
//              second provider (open.er-api.com). Combined on the server,
//              with a one-hour cache so we don't hammer the free APIs.
const Book = require('../Models/Book');
const Store = require('../Models/Store');

const CURRENCIES = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  NZD: 'New Zealand Dollar',
  BRL: 'Brazilian Real',
};

// --- simple in-memory cache for the exchange rates (1 hour) ---
let ratesCache = { data: null, fetchedAt: 0 };
const CACHE_MS = 60 * 60 * 1000;

async function getRates() {
  const now = Date.now();
  if (ratesCache.data && now - ratesCache.fetchedAt < CACHE_MS) {
    return { ...ratesCache.data, cached: true };
  }

  const symbols = Object.keys(CURRENCIES).join(',');
  let primary = null;
  let crosscheck = null;

  // Source 1: Frankfurter (European Central Bank data)
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=AUD&to=${symbols}`);
    if (res.ok) {
      const json = await res.json();
      primary = { provider: 'frankfurter.app (ECB)', date: json.date, rates: json.rates };
    }
  } catch (err) {
    console.error('Frankfurter unavailable:', err.message);
  }

  // Source 2: open.er-api.com - used as a cross-check, and as a fallback
  // if the first provider is down (a mashup should cope with a source failing).
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/AUD');
    if (res.ok) {
      const json = await res.json();
      if (json.result === 'success') {
        const picked = {};
        for (const code of Object.keys(CURRENCIES)) {
          if (json.rates[code] !== undefined) picked[code] = json.rates[code];
        }
        crosscheck = { provider: 'open.er-api.com', date: json.time_last_update_utc, rates: picked };
      }
    }
  } catch (err) {
    console.error('ER-API unavailable:', err.message);
  }

  const data = {
    base: 'AUD',
    currencies: CURRENCIES,
    primary: primary || crosscheck,          // fall back if Frankfurter is down
    crosscheck: primary ? crosscheck : null, // only a cross-check when both answered
    fetchedAt: new Date(now).toISOString(),
  };
  if (data.primary) ratesCache = { data, fetchedAt: now };
  return { ...data, cached: false };
}

// GET /mashups -> landing page listing the two mashups
exports.index = (req, res) => {
  res.render('mashups/index', { title: 'Mashups' });
};

// ---------- Mashup 1: store locator (map + weather) ----------

// GET /mashups/store-locator -> page with the Leaflet map
exports.storeLocator = (req, res) => {
  res.render('mashups/store-locator', { title: 'Store locator', stores: Store.all() });
};

// GET /mashups/api/stores -> our store data as JSON (fetched by the map page,
// and a nice target for the Postman evidence)
exports.storesJson = (req, res) => {
  res.json(Store.all());
};

// ---------- Mashup 2: live international pricing ----------

// GET /mashups/pricing -> catalogue priced in foreign currencies
exports.pricing = async (req, res) => {
  const rates = await getRates();
  res.render('mashups/pricing', {
    title: 'International pricing',
    books: Book.all(),
    rates,
    selected: (req.query.currency || 'USD').toUpperCase(),
  });
};

// GET /mashups/api/rates -> the merged rates JSON (Postman evidence target)
exports.ratesJson = async (req, res) => {
  res.json(await getRates());
};

// GET /mashups/api/weather?lat=..&lng=.. -> live weather from Open-Meteo,
// proxied through our server so the page works regardless of browser
// network rules (and it makes another clean Postman evidence target).
exports.weatherJson = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`);
    if (!r.ok) throw new Error(`Open-Meteo answered ${r.status}`);
    const json = await r.json();
    res.json({ source: 'api.open-meteo.com', current: json.current, units: json.current_units });
  } catch (err) {
    console.error('Weather unavailable:', err.message);
    res.status(502).json({ error: 'Weather service unavailable' });
  }
};
