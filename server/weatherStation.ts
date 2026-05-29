// © 2025 Glidr — Proprietary and confidential. All rights reserved.

export interface WeatherReading {
  airTemperatureC?: number;
  snowTemperatureC?: number;
  airHumidityPct?: number;
  snowHumidityPct?: number;
  wind?: string;
  precipitation?: string;
  clouds?: number;
  visibility?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toUnix(date: string, time: string): number {
  return Math.floor(new Date(`${date}T${time}:00`).getTime() / 1000);
}

function closest(readings: { timestamp: number; values: WeatherReading }[], targetUnix: number): WeatherReading {
  if (!readings.length) return {};
  return readings.reduce((best, r) =>
    Math.abs(r.timestamp - targetUnix) < Math.abs(best.timestamp - targetUnix) ? r : best
  ).values;
}

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

// ── Station implementations ───────────────────────────────────────────────────

async function fetchNetatmo(config: any, date: string, time: string): Promise<WeatherReading> {
  // Get access token
  const tokenRes = await fetch("https://api.netatmo.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      username: config.username,
      password: config.password,
      scope: "read_station",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Netatmo auth failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const target = toUnix(date, time);
  const params = new URLSearchParams({
    device_id: config.deviceId,
    type: "Temperature,Humidity",
    date_begin: String(target - 3600),
    date_end: String(target + 3600),
    optimize: "false",
    real_time: "false",
  });
  const dataRes = await fetch(`https://api.netatmo.com/api/getmeasure?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!dataRes.ok) throw new Error(`Netatmo data failed: ${dataRes.status}`);
  const data = await dataRes.json();
  // Netatmo returns { body: { "timestamp": [temp, humidity], ... } }
  const body = data.body || {};
  const readings = Object.entries(body).map(([ts, vals]: [string, any]) => ({
    timestamp: parseInt(ts),
    values: {
      airTemperatureC: Array.isArray(vals) ? vals[0] : undefined,
      airHumidityPct: Array.isArray(vals) ? vals[1] : undefined,
    },
  }));
  return closest(readings, target);
}

async function fetchDavis(config: any, date: string, time: string): Promise<WeatherReading> {
  const target = toUnix(date, time);
  const start = target - 3600;
  const end = target + 3600;
  // Davis WeatherLink v2 requires HMAC signature
  const crypto = await import("crypto");
  const params: Record<string, string> = {
    "api-key": config.apiKey,
    "station-id": config.stationId,
    "start-timestamp": String(start),
    "end-timestamp": String(end),
    "t": String(Math.floor(Date.now() / 1000)),
  };
  const paramStr = Object.keys(params).sort().map(k => `${k}${params[k]}`).join("");
  const signature = crypto.createHmac("sha256", config.apiSecret).update(paramStr).digest("hex");
  const qs = new URLSearchParams({ ...params, "api-signature": signature }).toString();
  const res = await fetch(`https://api.weatherlink.com/v2/historic/${config.stationId}?${qs}`);
  if (!res.ok) throw new Error(`Davis API failed: ${res.status}`);
  const data = await res.json();
  const sensors = data.sensors || [];
  const readings = sensors.flatMap((s: any) =>
    (s.data || []).map((d: any) => ({
      timestamp: d.ts || 0,
      values: {
        airTemperatureC: d.temp_avg != null ? ((d.temp_avg - 32) * 5) / 9 : undefined, // F→C
        airHumidityPct: d.hum_last,
        wind: d.wind_speed_avg != null ? `${Math.round(d.wind_speed_avg * 0.447)} m/s` : undefined,
        precipitation: d.rainfall_mm != null ? `${d.rainfall_mm} mm` : undefined,
      } as WeatherReading,
    }))
  );
  return closest(readings, target);
}

async function fetchAmbientWeather(config: any, date: string, time: string): Promise<WeatherReading> {
  const target = toUnix(date, time);
  const endDate = new Date((target + 3600) * 1000).toISOString();
  const res = await fetch(
    `https://api.ambientweather.net/v1/devices/${config.macAddress}?applicationKey=${config.applicationKey}&apiKey=${config.apiKey}&endDate=${encodeURIComponent(endDate)}&limit=24`
  );
  if (!res.ok) throw new Error(`Ambient Weather API failed: ${res.status}`);
  const data = await res.json();
  const readings = (Array.isArray(data) ? data : []).map((d: any) => ({
    timestamp: Math.floor(new Date(d.date).getTime() / 1000),
    values: {
      airTemperatureC: d.tempf != null ? ((d.tempf - 32) * 5) / 9 : undefined,
      airHumidityPct: d.humidity,
      wind: d.windspeedmph != null ? `${Math.round(d.windspeedmph * 0.447)} m/s` : undefined,
      precipitation: d.hourlyrainin != null ? `${Math.round(d.hourlyrainin * 25.4)} mm` : undefined,
    } as WeatherReading,
  }));
  return closest(readings, target);
}

async function fetchEcowitt(config: any, date: string, time: string): Promise<WeatherReading> {
  const dateStr = date; // YYYY-MM-DD
  const res = await fetch("https://api.ecowitt.net/api/v3/device/history", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      application_key: config.applicationKey,
      api_key: config.apiKey,
      mac: config.mac,
      start_date: `${dateStr} 00:00:00`,
      end_date: `${dateStr} 23:59:59`,
      cycle_type: "1",
      call_back: "outdoor,wind,rainfall",
    }),
  });
  if (!res.ok) throw new Error(`Ecowitt API failed: ${res.status}`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Ecowitt error: ${data.msg}`);
  const target = toUnix(date, time);
  const outdoor = data.data?.outdoor?.temperature?.list || {};
  const humidity = data.data?.outdoor?.humidity?.list || {};
  const windSpeed = data.data?.wind?.wind_speed?.list || {};
  const rain = data.data?.rainfall?.hourly?.list || {};
  const timestamps = Object.keys(outdoor).map(ts => parseInt(ts));
  if (!timestamps.length) return {};
  const bestTs = timestamps.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b);
  const tsStr = String(bestTs);
  return {
    airTemperatureC: outdoor[tsStr] != null ? parseFloat(outdoor[tsStr]) : undefined,
    airHumidityPct: humidity[tsStr] != null ? parseFloat(humidity[tsStr]) : undefined,
    wind: windSpeed[tsStr] != null ? `${windSpeed[tsStr]} m/s` : undefined,
    precipitation: rain[tsStr] != null ? `${rain[tsStr]} mm` : undefined,
  };
}

async function fetchWeatherUnderground(config: any, date: string, time: string): Promise<WeatherReading> {
  const dateCompact = date.replace(/-/g, "");
  const res = await fetch(
    `https://api.weather.com/v2/pws/history/hourly?stationId=${config.stationId}&format=json&units=m&date=${dateCompact}&apiKey=${config.apiKey}&numericPrecision=decimal`
  );
  if (!res.ok) throw new Error(`Weather Underground API failed: ${res.status}`);
  const data = await res.json();
  const observations = data.observations || [];
  const target = toUnix(date, time);
  const readings = observations.map((o: any) => ({
    timestamp: o.epoch || 0,
    values: {
      airTemperatureC: o.metric?.tempAvg,
      airHumidityPct: o.humidityAvg,
      wind: o.metric?.windspeedAvg != null ? `${Math.round(o.metric.windspeedAvg / 3.6)} m/s` : undefined,
      precipitation: o.metric?.precipTotal != null ? `${o.metric.precipTotal} mm` : undefined,
    } as WeatherReading,
  }));
  return closest(readings, target);
}

async function fetchOpenMeteo(config: any, date: string, time: string): Promise<WeatherReading> {
  const res = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${config.latitude}&longitude=${config.longitude}&start_date=${date}&end_date=${date}&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,precipitation,cloudcover&timezone=auto`
  );
  if (!res.ok) throw new Error(`Open-Meteo API failed: ${res.status}`);
  const data = await res.json();
  const hourly = data.hourly || {};
  const times: string[] = hourly.time || [];
  const hour = parseInt(time.split(":")[0]);
  // Find closest hour
  const idx = times.findIndex(t => parseInt(t.split("T")[1]?.split(":")[0] ?? "0") >= hour);
  const i = idx >= 0 ? idx : times.length - 1;
  return {
    airTemperatureC: hourly.temperature_2m?.[i],
    airHumidityPct: hourly.relativehumidity_2m?.[i],
    wind: hourly.windspeed_10m?.[i] != null ? `${Math.round(hourly.windspeed_10m[i] / 3.6)} m/s` : undefined,
    precipitation: hourly.precipitation?.[i] != null ? `${hourly.precipitation[i]} mm` : undefined,
    clouds: hourly.cloudcover?.[i] != null ? Math.round(hourly.cloudcover[i] / 12.5) : undefined, // % → x/8
  };
}

async function fetchGenericHttp(config: any, date: string, time: string): Promise<WeatherReading> {
  const url = config.urlTemplate
    .replace("{date}", date)
    .replace("{time}", time)
    .replace("{datetime}", `${date}T${time}:00`);

  const headers: Record<string, string> = {};
  if (config.authType === "bearer" && config.bearerToken) {
    headers["Authorization"] = `Bearer ${config.bearerToken}`;
  } else if (config.authType === "basic" && config.basicUsername && config.basicPassword) {
    headers["Authorization"] = `Basic ${Buffer.from(`${config.basicUsername}:${config.basicPassword}`).toString("base64")}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Generic HTTP fetch failed: ${res.status}`);
  const data = await res.json();

  const reading: WeatherReading = {};
  if (config.fieldMap) {
    const fm = config.fieldMap;
    if (fm.airTemperatureC) reading.airTemperatureC = getPath(data, fm.airTemperatureC);
    if (fm.snowTemperatureC) reading.snowTemperatureC = getPath(data, fm.snowTemperatureC);
    if (fm.airHumidityPct) reading.airHumidityPct = getPath(data, fm.airHumidityPct);
    if (fm.snowHumidityPct) reading.snowHumidityPct = getPath(data, fm.snowHumidityPct);
    if (fm.wind) reading.wind = getPath(data, fm.wind);
    if (fm.precipitation) reading.precipitation = getPath(data, fm.precipitation);
    if (fm.clouds) reading.clouds = getPath(data, fm.clouds);
    if (fm.visibility) reading.visibility = getPath(data, fm.visibility);
  }
  return reading;
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

export async function fetchWeatherFromStation(
  stationType: string,
  config: any,
  date: string,
  time: string
): Promise<WeatherReading> {
  switch (stationType) {
    case "netatmo": return fetchNetatmo(config, date, time);
    case "davis": return fetchDavis(config, date, time);
    case "ambient": return fetchAmbientWeather(config, date, time);
    case "ecowitt": return fetchEcowitt(config, date, time);
    case "wunderground": return fetchWeatherUnderground(config, date, time);
    case "openmeteo": return fetchOpenMeteo(config, date, time);
    case "generic": return fetchGenericHttp(config, date, time);
    default: throw new Error(`Unknown station type: ${stationType}`);
  }
}
