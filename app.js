const params = new URLSearchParams(window.location.search);
const tzParam = params.get("tz") || params.get("timezone");

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

const timezone = resolveTimezone();
const clockEl = document.getElementById("clock");
const labelEl = document.getElementById("timezone-label");

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: timezone,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function updateClock() {
  const now = new Date();
  const time = timeFormatter.format(now);
  const date = dateFormatter.format(now);

  clockEl.textContent = time;
  clockEl.setAttribute("datetime", now.toISOString());
  labelEl.textContent = `${date} · ${timezone}`;
}

updateClock();
setInterval(updateClock, 1000);
