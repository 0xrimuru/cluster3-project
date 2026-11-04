// MashupController (ICTPRG538 - Create Mashups).
// Two mashups, each combining data from MORE THAN ONE external service:
//
//   Mashup 1 - Store locator: OpenStreetMap map tiles (via Leaflet) + live
//              weather for each store from the Open-Meteo API + our own
//              store data. Combined in the browser (client-side fetch).
//
//   Mashup 2 - Live international pricing: our product catalogue + exchange
//              rates from the Frankfurter API, cross-checked against a
//              second provider (open.er-api.com). Combined on the server,
//              with a one-hour cache so we don't hammer the free APIs.
const Product = require('../Models/Product');
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
  const get = async (name, url) => { // 5 s limit: a stalled provider must not hang the page
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return res.ok ? await res.json() : null;
    } catch (err) { console.error(`${name} unavailable:`, err.message); return null; }
  };
  // Source 1: Frankfurter (European Central Bank data). Source 2: open.er-api.com - a cross-check,
  // and the fallback if the first provider is down (a mashup should cope with a source failing).
  const [fr, er] = await Promise.all([
    get('Frankfurter', `https://api.frankfurter.app/latest?from=AUD&to=${symbols}`),
    get('ER-API', 'https://open.er-api.com/v6/latest/AUD'),
  ]);
  const primary = fr && fr.rates ? { provider: 'frankfurter.app (ECB)', date: fr.date, rates: fr.rates } : null;
  let crosscheck = null;
  if (er && er.result === 'success') {
    const picked = {};
    for (const code of Object.keys(CURRENCIES)) if (er.rates[code] !== undefined) picked[code] = er.rates[code];
    crosscheck = { provider: 'open.er-api.com', date: er.time_last_update_utc, rates: picked };
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
  res.render('mashups/index', { nav: 'more', title: 'About LPA' });
};

// ---------- Mashup 1: store locator (map + weather) ----------

// GET /mashups/store-locator -> page with the Leaflet map
exports.storeLocator = (req, res) => {
  res.render('mashups/store-locator', { nav: 'more', title: 'Store locator', stores: Store.all() });
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
  res.render('mashups/pricing', { nav: 'more',
    title: 'International pricing',
    products: await Product.forSale(),
    rates,
    selected: String(req.query.currency || 'USD').toUpperCase(),
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
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Open-Meteo answered ${r.status}`);
    const json = await r.json();
    res.json({ source: 'api.open-meteo.com', current: json.current, units: json.current_units });
  } catch (err) {
    console.error('Weather unavailable:', err.message);
    res.status(502).json({ error: 'Weather service unavailable' });
  }
};
