export async function fetchWeather(c) {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,cloud_cover&timezone=auto`
  );
  if (!r.ok) return null;
  const j = await r.json(),
    cur = j.current;
  if (!cur) return null;
  const code = cur.weather_code,
    temp = Math.round(cur.temperature_2m);
  const heavy = [61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code),
    light = [51, 53, 55, 56, 57].includes(code);
  const desc =
    code === 0
      ? 'Clear'
      : code <= 2
        ? 'Partly cloudy'
        : code === 3
          ? 'Overcast'
          : code <= 48
            ? 'Fog'
            : code <= 57
              ? 'Drizzle'
              : code <= 67
                ? 'Rain'
                : code <= 77
                  ? 'Snow'
                  : code <= 82
                    ? 'Showers'
                    : 'Thunderstorm';
  return {
    temp,
    code,
    cloud: Math.min(1, (cur.cloud_cover == null ? 20 : cur.cloud_cover) / 100),
    rain: heavy ? 1 : light ? 0.4 : 0,
    fog: code === 45 || code === 48 ? 1 : 0,
    text: `${c.label || ''} ${temp}°C ${desc}`.trim(),
    offsetHours: (j.utc_offset_seconds || 0) / 3600,
  };
}
