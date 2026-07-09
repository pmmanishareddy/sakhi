// Real weather for the home greeting, via Open-Meteo (free, no key).
// Cached for 3 hours per city; returns null on any failure so the UI
// simply drops the line instead of showing stale or fake data.

export interface Weather {
  temp: number
  hint: string
}

const CACHE_KEY = 'sakhi_weather_cache'
const TTL_MS = 3 * 3600 * 1000

function hintFor(temp: number): string {
  if (temp >= 32) return 'breathable fabrics today'
  if (temp >= 24) return 'nice day for most things'
  if (temp >= 16) return 'light layers weather'
  return 'layer up today'
}

export async function getWeather(city: string): Promise<Weather | null> {
  if (!city) return null
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached && cached.city === city && Date.now() - cached.at < TTL_MS) return cached.w

    const geo = await (await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    )).json()
    const loc = geo.results?.[0]
    if (!loc) return null

    const wx = await (await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m`
    )).json()
    const temp = Math.round(wx.current?.temperature_2m)
    if (!Number.isFinite(temp)) return null

    const w: Weather = { temp, hint: hintFor(temp) }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ city, at: Date.now(), w })) } catch { /* full */ }
    return w
  } catch {
    return null
  }
}
