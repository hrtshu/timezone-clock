const params = new URLSearchParams(window.location.search);
const tzParam = params.get("tz") || params.get("timezone");
const secondaryTzParam = params.get("subtz") || params.get("subtimezone");
const untilParam = params.get("until");
const eventNameParam = params.get("event");
const weatherParam = params.get("weather");
const weatherLocationParam = params.get("wloc");
const locationNameParam = params.get("loc");

function resolveTimezone() {
  if (!tzParam) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tzParam });
    return tzParam;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

function isValidTimezone(value) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function getDateInTimezone(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function createDateInTimezone(values, timeZone) {
  let result = new Date(
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ),
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedDateParts(result, timeZone);
    const desiredUtc = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    result = new Date(result.getTime() + desiredUtc - actualUtc);
  }

  return result;
}

function parseUntil(value, timeZone) {
  if (!value) {
    return null;
  }

  const input = value.trim();
  const explicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);
  if (explicitOffset) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  let text = input;
  let targetTimezone = timeZone;
  const timezoneMatch = text.match(
    /(?:\s+|\[)([A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)\]?$/,
  );
  if (timezoneMatch && isValidTimezone(timezoneMatch[1])) {
    targetTimezone = timezoneMatch[1];
    text = text.slice(0, timezoneMatch.index).trim();
  }

  text = text
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/時/g, ":")
    .replace(/分/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const dateTimeMatch = text.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
  );
  const timeOnlyMatch = text.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
  const now = new Date();
  let values;

  if (dateTimeMatch) {
    values = {
      year: Number(dateTimeMatch[1]),
      month: Number(dateTimeMatch[2]),
      day: Number(dateTimeMatch[3]),
      hour: Number(dateTimeMatch[4] || 0),
      minute: Number(dateTimeMatch[5] || 0),
      second: Number(dateTimeMatch[6] || 0),
    };
  } else if (timeOnlyMatch) {
    values = {
      ...getDateInTimezone(now, targetTimezone),
      hour: Number(timeOnlyMatch[1]),
      minute: Number(timeOnlyMatch[2] || 0),
      second: Number(timeOnlyMatch[3] || 0),
    };
  } else {
    return null;
  }

  const parsed = createDateInTimezone(values, targetTimezone);
  if (timeOnlyMatch && parsed <= now) {
    const nextDay = new Date(
      Date.UTC(values.year, values.month - 1, values.day + 1),
    );
    values.year = nextDay.getUTCFullYear();
    values.month = nextDay.getUTCMonth() + 1;
    values.day = nextDay.getUTCDate();
    return createDateInTimezone(values, targetTimezone);
  }

  return parsed;
}

function formatDuration(milliseconds) {
  const sign = milliseconds < 0 ? "-" : "";
  let minutes = Math.floor(Math.abs(milliseconds) / 60000);
  const days = Math.floor(minutes / 1440);
  minutes %= 1440;
  const hours = Math.floor(minutes / 60);
  minutes %= 60;

  const dayText = days > 0 ? `${days}d ` : "";
  return `${sign}${dayText}${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatTargetDate(now, target) {
  const nowParts = targetDateKeyFormatter.formatToParts(now);
  const targetParts = targetDateKeyFormatter.formatToParts(target);
  const getValue = (parts, type) =>
    parts.find((part) => part.type === type).value;
  const sameYear = getValue(nowParts, "year") === getValue(targetParts, "year");
  const sameMonth =
    getValue(nowParts, "month") === getValue(targetParts, "month");
  const sameDay = getValue(nowParts, "day") === getValue(targetParts, "day");

  if (sameYear && sameMonth && sameDay) {
    return targetTimeFormatter.format(target);
  }

  return `${formatDateParts(dateFormatter.formatToParts(target), !sameYear)} ${targetTimeFormatter.format(target)}`;
}

function formatDate(date) {
  return formatDateParts(dateFormatter.formatToParts(date), true);
}

function formatDateParts(parts, includeYear) {
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  const yearText = includeYear ? `${values.year}.` : "";
  return `${yearText}${values.month}.${values.day} (${values.weekday})`;
}

function getDateKey(formatter, date) {
  return formatter
    .formatToParts(date)
    .filter(({ type }) => ["year", "month", "day"].includes(type))
    .map(({ type, value }) => `${type}=${value}`)
    .join(";");
}

const timezone = resolveTimezone();
const secondaryTimezone =
  secondaryTzParam && isValidTimezone(secondaryTzParam)
    ? secondaryTzParam
    : null;
const targetDate = parseUntil(untilParam, timezone);
const clockEl = document.getElementById("clock");
const secondaryClockEl = document.getElementById("secondary-clock");
const secondaryDateEl = document.getElementById("secondary-date");
const secondaryTimeEl = document.getElementById("secondary-time");
const secondaryTimezoneEl = document.getElementById("secondary-timezone");
const labelEl = document.getElementById("timezone-label");
const dateLabelEl = document.getElementById("date-label");
const timezoneNameEl = document.getElementById("timezone-name");
const countdownEl = document.getElementById("countdown");
const countdownDurationEl = document.getElementById("countdown-duration");
const countdownLeftEl = document.getElementById("countdown-left");
const countdownTargetEl = document.getElementById("countdown-target");
const weatherEl = document.getElementById("weather");
const weatherIconEl = document.getElementById("weather-icon");
const weatherTempEl = document.getElementById("weather-temp");
const weatherLocationEl = document.getElementById("weather-location");

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: timezone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const targetDateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: timezone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const targetTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const secondaryTimeFormatter = secondaryTimezone
  ? new Intl.DateTimeFormat("ja-JP", {
      timeZone: secondaryTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  : null;

const secondaryDateFormatter = secondaryTimezone
  ? new Intl.DateTimeFormat("en-US", {
      timeZone: secondaryTimezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    })
  : null;

const secondaryDateKeyFormatter = secondaryTimezone
  ? new Intl.DateTimeFormat("en-US", {
      timeZone: secondaryTimezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
  : null;

const containerEl = document.querySelector(".clock-container");

function fitToViewport() {
  // 一旦スケールを戻してコンテンツの自然な高さを測り、
  // 画面の高さ（100%）に収まる倍率まで全体を縮小する。収まる場合は等倍。
  containerEl.style.transform = "";
  const naturalHeight = containerEl.scrollHeight;
  if (naturalHeight > window.innerHeight) {
    containerEl.style.transform = `scale(${window.innerHeight / naturalHeight})`;
  }
}

function updateClock() {
  const now = new Date();
  const time = timeFormatter.format(now);
  const date = formatDate(now);

  clockEl.textContent = time;
  clockEl.setAttribute("datetime", now.toISOString());
  dateLabelEl.textContent = date;
  timezoneNameEl.textContent = timezone;

  if (secondaryTimeFormatter) {
    secondaryClockEl.style.display = "flex";
    const secondaryDateKey = getDateKey(secondaryDateKeyFormatter, now);
    const primaryDateKey = getDateKey(targetDateKeyFormatter, now);
    const secondaryParts = secondaryDateFormatter.formatToParts(now);
    const secondaryYear = secondaryParts.find(
      ({ type }) => type === "year",
    ).value;
    const primaryParts = dateFormatter.formatToParts(now);
    const primaryYear = primaryParts.find(({ type }) => type === "year").value;

    if (secondaryDateKey === primaryDateKey) {
      secondaryDateEl.style.display = "none";
    } else {
      secondaryDateEl.style.display = "inline";
      secondaryDateEl.textContent = formatDateParts(
        secondaryParts,
        secondaryYear !== primaryYear,
      );
    }
    secondaryTimeEl.textContent = secondaryTimeFormatter.format(now);
    secondaryTimezoneEl.textContent = secondaryTimezone;
    secondaryClockEl.setAttribute("datetime", now.toISOString());
  }

  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    const remainingMilliseconds = targetDate.getTime() - now.getTime();
    countdownEl.style.display = "flex";
    countdownEl.classList.toggle("is-expired", remainingMilliseconds < 0);
    countdownDurationEl.textContent = formatDuration(remainingMilliseconds);
    countdownLeftEl.textContent = "left";
    const targetLabel = formatTargetDate(now, targetDate);
    countdownTargetEl.textContent = eventNameParam
      ? `until ${eventNameParam} (${targetLabel})`
      : `until ${targetLabel}`;
  }

  fitToViewport();
}

updateClock();
setInterval(updateClock, 1000);
window.addEventListener("resize", fitToViewport);

// 天気表示: Open-Meteo（APIキー不要・CORS対応）から現在気温と天気を取得する。
// 取得地点は天気専用の wloc パラメータで指定し、タイムゾーンとは連動しない。
// 未指定・不正な指定の場合は東京。geolocation は使わない（キャスト先で
// 許可ダイアログが出ると時計表示の邪魔になるため）。
const WEATHER_LOCATION_PRESETS = {
  tokyo: { lat: 35.6812, lon: 139.7671, name: "東京" },
  osaka: { lat: 34.6937, lon: 135.5023, name: "大阪" },
  nagoya: { lat: 35.1815, lon: 136.9066, name: "名古屋" },
  kyoto: { lat: 35.0116, lon: 135.7681, name: "京都" },
  sapporo: { lat: 43.0618, lon: 141.3545, name: "札幌" },
  sendai: { lat: 38.2682, lon: 140.8694, name: "仙台" },
  hiroshima: { lat: 34.3853, lon: 132.4553, name: "広島" },
  fukuoka: { lat: 33.5904, lon: 130.4017, name: "福岡" },
  naha: { lat: 26.2124, lon: 127.6809, name: "那覇" },
  seoul: { lat: 37.5665, lon: 126.978, name: "ソウル" },
  shanghai: { lat: 31.2304, lon: 121.4737, name: "上海" },
  hongkong: { lat: 22.3193, lon: 114.1694, name: "香港" },
  taipei: { lat: 25.033, lon: 121.5654, name: "台北" },
  singapore: { lat: 1.3521, lon: 103.8198, name: "シンガポール" },
  bangkok: { lat: 13.7563, lon: 100.5018, name: "バンコク" },
  kolkata: { lat: 22.5726, lon: 88.3639, name: "コルカタ" },
  dubai: { lat: 25.2048, lon: 55.2708, name: "ドバイ" },
  london: { lat: 51.5074, lon: -0.1278, name: "ロンドン" },
  paris: { lat: 48.8566, lon: 2.3522, name: "パリ" },
  berlin: { lat: 52.52, lon: 13.405, name: "ベルリン" },
  moscow: { lat: 55.7558, lon: 37.6173, name: "モスクワ" },
  newyork: { lat: 40.7128, lon: -74.006, name: "ニューヨーク" },
  chicago: { lat: 41.8781, lon: -87.6298, name: "シカゴ" },
  denver: { lat: 39.7392, lon: -104.9903, name: "デンバー" },
  losangeles: { lat: 34.0522, lon: -118.2437, name: "ロサンゼルス" },
  toronto: { lat: 43.6532, lon: -79.3832, name: "トロント" },
  saopaulo: { lat: -23.5505, lon: -46.6333, name: "サンパウロ" },
  sydney: { lat: -33.8688, lon: 151.2093, name: "シドニー" },
  auckland: { lat: -36.8485, lon: 174.7633, name: "オークランド" },
};
const DEFAULT_WEATHER_LOCATION = WEATHER_LOCATION_PRESETS.tokyo;
// 更新間隔はページ読み込み時点が基準（読み込み直後に取得し、以後この間隔で再取得）
// Open-Meteo の現在値も15分刻みで更新されるため、それに合わせている
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

// 地点解決は初回だけ行い、以後はキャッシュした座標で天気を取り続ける
let weatherLocationPromise = null;

function getWeatherLocation() {
  if (!weatherLocationPromise) {
    weatherLocationPromise = resolveWeatherLocation();
  }
  return weatherLocationPromise;
}

async function resolveWeatherLocation() {
  if (weatherLocationParam) {
    const key = weatherLocationParam.trim().toLowerCase();
    const preset = WEATHER_LOCATION_PRESETS[key];
    if (preset) {
      return { ...preset, name: locationNameParam || preset.name };
    }
    // プリセット名でなければ "緯度,経度" 形式として解釈する
    const parts = weatherLocationParam.split(",");
    if (parts.length === 2) {
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      ) {
        return { lat, lon, name: locationNameParam || "" };
      }
    }
    // それでもなければ地名としてジオコーディングAPIで座標に解決する
    try {
      const geoUrl =
        "https://geocoding-api.open-meteo.com/v1/search" +
        `?name=${encodeURIComponent(weatherLocationParam.trim())}` +
        "&count=1&language=ja&format=json";
      const response = await fetch(geoUrl);
      if (response.ok) {
        const data = await response.json();
        const place = data && data.results && data.results[0];
        if (
          place &&
          typeof place.latitude === "number" &&
          typeof place.longitude === "number"
        ) {
          return {
            lat: place.latitude,
            lon: place.longitude,
            name: locationNameParam || place.name || "",
          };
        }
      }
    } catch {
      // 解決できなければ東京にフォールバックする
    }
  }
  return {
    ...DEFAULT_WEATHER_LOCATION,
    name: locationNameParam || DEFAULT_WEATHER_LOCATION.name,
  };
}

// WMO weather code → 天気マークと読み上げ用の天気名
function weatherIconAndLabel(weatherCode, isDay) {
  if (weatherCode === 0) return isDay ? ["☀️", "快晴"] : ["🌙", "快晴"];
  if (weatherCode === 1) return isDay ? ["🌤️", "晴れ"] : ["🌙", "晴れ"];
  if (weatherCode === 2) return ["⛅", "晴れ時々くもり"];
  if (weatherCode === 3) return ["☁️", "くもり"];
  if (weatherCode === 45 || weatherCode === 48) return ["🌫️", "霧"];
  if (weatherCode >= 51 && weatherCode <= 55) return ["🌦️", "霧雨"];
  if (weatherCode === 56 || weatherCode === 57) return ["🌨️", "着氷性の霧雨"];
  if (weatherCode === 61) return ["🌦️", "弱い雨"];
  if (weatherCode === 63) return ["🌧️", "雨"];
  if (weatherCode === 65) return ["🌧️", "強い雨"];
  if (weatherCode === 66 || weatherCode === 67) return ["🌧️", "着氷性の雨"];
  if (weatherCode === 71) return ["🌨️", "弱い雪"];
  if (weatherCode === 73) return ["🌨️", "雪"];
  if (weatherCode === 75) return ["🌨️", "強い雪"];
  if (weatherCode === 77) return ["🌨️", "霧雪"];
  if (weatherCode === 80) return ["🌦️", "弱いにわか雨"];
  if (weatherCode === 81) return ["🌧️", "にわか雨"];
  if (weatherCode === 82) return ["🌧️", "強いにわか雨"];
  if (weatherCode === 85 || weatherCode === 86) return ["🌨️", "にわか雪"];
  if (weatherCode === 95) return ["⛈️", "雷雨"];
  if (weatherCode === 96 || weatherCode === 99) return ["⛈️", "雹を伴う雷雨"];
  return ["🌡️", ""];
}

async function updateWeather() {
  const { lat, lon, name } = await getWeatherLocation();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const apiUrl =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,weather_code,is_day&timezone=auto";
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return;
    const data = await response.json();
    const current = data && data.current;
    if (!current || typeof current.temperature_2m !== "number") return;
    const [icon, label] = weatherIconAndLabel(
      current.weather_code,
      current.is_day === 1,
    );
    const temp = Math.round(current.temperature_2m);
    weatherIconEl.textContent = icon;
    weatherTempEl.textContent = `${temp}°`;
    weatherLocationEl.textContent = name;
    weatherEl.setAttribute(
      "aria-label",
      [name, label, `${temp}度`].filter(Boolean).join(" "),
    );
    weatherEl.style.display = "flex";
    fitToViewport();
  } catch {
    // 取得できない間は天気欄を出さない（次回更新で再試行、時計表示は継続）
  }
}

// 天気はクエリ文字列がある場合にだけ表示する（素のURLでは時計のみ）
if (
  weatherParam !== "off" &&
  weatherParam !== "0" &&
  window.location.search !== ""
) {
  updateWeather();
  setInterval(updateWeather, WEATHER_REFRESH_MS);
}
