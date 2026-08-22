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
  const nowDate = targetDateKeyFormatter.format(now);
  const targetDateKey = targetDateKeyFormatter.format(target);

  return nowDate === targetDateKey
    ? targetTimeFormatter.format(target)
    : `${formatDate(target)} ${targetTimeFormatter.format(target)}`;
}

function formatDate(date) {
  const parts = dateFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}.${values.month}.${values.day} (${values.weekday})`;
}

const timezone = resolveTimezone();
const secondaryTimezone =
  secondaryTzParam && isValidTimezone(secondaryTzParam)
    ? secondaryTzParam
    : null;
const targetDate = untilParam ? new Date(untilParam) : null;
const clockEl = document.getElementById("clock");
const secondaryClockEl = document.getElementById("secondary-clock");
const secondaryTimeEl = document.getElementById("secondary-time");
const secondaryTimezoneEl = document.getElementById("secondary-timezone");
const labelEl = document.getElementById("timezone-label");
const countdownEl = document.getElementById("countdown");

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

function updateClock() {
  const now = new Date();
  const time = timeFormatter.format(now);
  const date = formatDate(now);

  clockEl.textContent = time;
  clockEl.setAttribute("datetime", now.toISOString());
  labelEl.textContent = `${date} ${timezone}`;

  if (secondaryTimeFormatter) {
    secondaryClockEl.style.display = "block";
    secondaryTimeEl.textContent = secondaryTimeFormatter.format(now);
    secondaryTimezoneEl.textContent = secondaryTimezone;
    secondaryClockEl.setAttribute("datetime", now.toISOString());
  }

  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    const remainingMilliseconds = targetDate.getTime() - now.getTime();
    countdownEl.style.display = "block";
    countdownEl.classList.toggle("is-expired", remainingMilliseconds < 0);
    countdownEl.textContent = `${formatDuration(remainingMilliseconds)} left until ${formatTargetDate(now, targetDate)}`;
  }
}

updateClock();
setInterval(updateClock, 1000);
