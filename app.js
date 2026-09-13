const params = new URLSearchParams(window.location.search);
const tzParam = params.get("tz") || params.get("timezone");
const secondaryTzParam = params.get("subtz") || params.get("subtimezone");
const untilParam = params.get("until");

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
  return `${sign}${dayText}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
    countdownTargetEl.textContent = `until ${formatTargetDate(now, targetDate)}`;
  }
}

updateClock();
setInterval(updateClock, 1000);
