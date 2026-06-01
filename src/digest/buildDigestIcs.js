// === Sunday Digest .ics builder (May 2026) =========================
// Generates an iCalendar (RFC 5545) reminder for the weekly Sunday
// Digest. Two flavors:
//
//   1. buildSundayDigestIcs(digest) — one-shot event for THIS Sunday
//      with the digest body embedded as the event DESCRIPTION. The
//      user sees their full week-read inside the calendar event.
//
//   2. downloadSundayDigest(digest) — wraps (1) in a blob download so
//      the file lands in the user's downloads folder, ready to open
//      in Apple Calendar / Google Calendar / Outlook. Also adds a
//      recurring weekly companion event so future Sundays keep
//      reminding even before the user re-opens the app.
//
// The existing module-scope `downloadIcsReminder` in index.jsx.source
// just drops a generic recurring reminder with a URL. This module is
// the upgraded version: it carries the actual digest text so the
// reminder is useful before you tap into the app.
// ===================================================================

// RFC 5545 line folding: any logical line longer than 75 octets must
// be split with CRLF + space. We're conservative and fold at 73 chars.
const foldIcsLine = (line) => {
  if (!line || line.length <= 73) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
    i += 73;
  }
  return out.join('\r\n');
};

// Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, newline.
const escapeIcsText = (text) => String(text || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r\n|\r|\n/g, '\\n');

const pad2 = (n) => String(n).padStart(2, '0');
const fmtLocal = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;

const nextSundayAt = (hour = 9, minute = 0, base = new Date()) => {
  const t = new Date(base);
  const daysUntil = (7 - t.getDay()) % 7 || 7;
  t.setDate(t.getDate() + daysUntil);
  t.setHours(hour, minute, 0, 0);
  return t;
};

// Build the .ics text. Single VCALENDAR with two VEVENTs:
//   - VEVENT 1 (this-week digest): DTSTART = upcoming Sunday 9 AM,
//     SUMMARY = "Frida · week of …", DESCRIPTION = digest plaintext.
//   - VEVENT 2 (recurring reminder): same anchor, RRULE weekly,
//     short description pointing user back to Frida.
const buildSundayDigestIcs = (digest, opts = {}) => {
  const {
    hour = 9,
    minute = 0,
    appUrl = 'https://tangjennii-wq.github.io/skinetude/',
  } = opts;

  if (!digest || typeof digest !== 'object') {
    throw new Error('buildSundayDigestIcs: digest object required');
  }

  const now = new Date();
  const start = nextSundayAt(hour, minute, now);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const stamp = fmtLocal(now);
  const dtstart = fmtLocal(start);
  const dtend = fmtLocal(end);

  const summaryThis = digest.headline || 'Frida · Sunday Digest';
  const descriptionThis = `${digest.plaintext || ''}\n\n${appUrl}`;

  const uidThis = `etude-digest-${digest.window?.start || start.getTime()}@etude.app`;
  const uidRecurring = `etude-digest-recurring@etude.app`;

  const oneShot = [
    'BEGIN:VEVENT',
    `UID:${uidThis}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(summaryThis)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionThis)}`),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
  ];

  const recurring = [
    'BEGIN:VEVENT',
    `UID:${uidRecurring}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    'SUMMARY:Frida · Sunday Digest',
    foldIcsLine(`DESCRIPTION:${escapeIcsText(`Open Frida → Journal for your weekly skin read.\n${appUrl}`)}`),
    'RRULE:FREQ=WEEKLY;BYDAY=SU',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
  ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Frida//Sunday Digest//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...oneShot,
    ...recurring,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
};

// Browser download wrapper. Safe to call from a button onClick.
const downloadSundayDigest = (digest, opts = {}) => {
  if (typeof window === 'undefined') return;
  const ics = buildSundayDigestIcs(digest, opts);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `etude-sunday-digest-${digest.window?.start || 'this-week'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
