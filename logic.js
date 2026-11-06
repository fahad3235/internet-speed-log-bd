/* Internet Speed Log BD - pure logic (no DOM). Shared by the page and node tests.
 * Dates are 'YYYY-MM-DD' strings; "today" is always passed in so tests are deterministic.
 * This file is pure ASCII: Bengali digits are \uXXXX escapes. */
'use strict';

const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
                   '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

const TYPES = ['Broadband', 'Mobile 4G', 'Mobile 5G', 'Wi-Fi hotspot'];
const MAX_ENTRIES = 5000;

function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isValidTime(s) {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return false;
  const hh = Number(s.slice(0, 2));
  const mm = Number(s.slice(3, 5));
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/* Parse a YYYY-MM-DD string to a UTC Date, or null when invalid. */
function parseDate(s) {
  if (!isValidDate(s)) return null;
  return new Date(s + 'T00:00:00Z');
}

function daysBetween(a, b) {
  // whole days from a to b (b - a); both valid YYYY-MM-DD
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

function fmt1(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function newId() {
  return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function cleanStr(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function isSpeed(v) {
  if (typeof v === 'boolean' || v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.1 && n <= 10000;
}

function isPing(v) {
  if (typeof v === 'boolean' || v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 2000;
}

/* Validate one log entry. Returns an array of error keys (empty = valid).
 * "today" (YYYY-MM-DD) is passed in so the future-date check is deterministic. */
function validateEntry(e, today) {
  const errs = [];
  if (!e || typeof e !== 'object') return ['entry'];
  if (!isValidDate(e.date)) errs.push('date');
  else if (today && isValidDate(today) && daysBetween(e.date, today) < 0) errs.push('date');
  if (!isValidTime(e.time)) errs.push('time');
  if (typeof e.isp !== 'string' || !e.isp.trim() || e.isp.trim().length > 60) errs.push('isp');
  if (!TYPES.includes(e.type)) errs.push('type');
  if (!isSpeed(e.download)) errs.push('download');
  if (!isSpeed(e.upload)) errs.push('upload');
  if (!isPing(e.ping)) errs.push('ping');
  return errs;
}

/* Quality bands are this app's own simple labels, not an official standard. */
function qualityBadge(download, ping) {
  const d = Number(download);
  const p = Number(ping);
  if (Number.isFinite(d) && Number.isFinite(p) && d >= 50 && p <= 30) return 'excellent';
  if (Number.isFinite(d) && Number.isFinite(p) && d >= 20 && p <= 60) return 'good';
  if (Number.isFinite(d) && Number.isFinite(p) && d >= 5 && p <= 120) return 'fair';
  return 'slow';
}

function avgMilli(values) {
  // average via exact integer-milli math, rounded to 1 decimal
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + Math.round(Number(v) * 1000), 0);
  return round1(sum / (values.length * 1000));
}

function medianOf(values) {
  if (!values.length) return null;
  const sorted = values.map(Number).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return round1(sorted[mid]);
  return round1((sorted[mid - 1] + sorted[mid]) / 2);
}

function inWindow(entry, today, fromDaysAgo, toDaysAgo) {
  // date is fromDaysAgo..toDaysAgo days before today (inclusive)
  if (!isValidDate(entry.date) || !isValidDate(today)) return false;
  const d = daysBetween(entry.date, today);
  return d >= toDaysAgo && d <= fromDaysAgo;
}

function stats(entries, today) {
  const list = entries || [];
  const result = {
    total: list.length,
    avgDown: null, medianDown: null, bestDown: null,
    avgUp: null, avgPing: null,
    trendPct: null, trend: null, bestIsp: null,
  };
  if (!list.length) return result;
  result.avgDown = avgMilli(list.map((e) => e.download));
  result.medianDown = medianOf(list.map((e) => e.download));
  result.bestDown = Math.max.apply(null, list.map((e) => Number(e.download)));
  result.avgUp = avgMilli(list.map((e) => e.upload));
  result.avgPing = avgMilli(list.map((e) => e.ping));
  // 7-day trend: last 7 days vs previous 7 days
  const cur = list.filter((e) => inWindow(e, today, 6, 0));
  const prev = list.filter((e) => inWindow(e, today, 13, 7));
  if (prev.length) {
    const curAvg = cur.length ? avgMilli(cur.map((e) => e.download)) : 0;
    const prevAvg = avgMilli(prev.map((e) => e.download));
    if (prevAvg && prevAvg > 0) {
      const pct = round1(((curAvg - prevAvg) / prevAvg) * 100);
      result.trendPct = pct;
      result.trend = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
    }
  }
  const ranked = perIsp(list).filter((r) => r.count >= 2);
  if (ranked.length) result.bestIsp = ranked[0].isp;
  return result;
}

function perIsp(entries) {
  const groups = {};
  (entries || []).forEach((e) => {
    const isp = cleanStr(e.isp, 60);
    if (!isp) return;
    if (!groups[isp]) groups[isp] = [];
    groups[isp].push(e);
  });
  const rows = Object.keys(groups).map((isp) => {
    const g = groups[isp];
    return {
      isp: isp,
      count: g.length,
      avgDown: avgMilli(g.map((e) => e.download)),
      avgUp: avgMilli(g.map((e) => e.upload)),
      avgPing: avgMilli(g.map((e) => e.ping)),
      bestDown: Math.max.apply(null, g.map((e) => Number(e.download))),
    };
  });
  rows.sort((a, b) => (b.avgDown - a.avgDown) || (b.count - a.count) ||
    (a.isp < b.isp ? -1 : (a.isp > b.isp ? 1 : 0)));
  return rows;
}

function byDateTime(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.time || '00:00';
  const tb = b.time || '00:00';
  return ta < tb ? -1 : (ta > tb ? 1 : 0);
}

/* Last 14 entries by date+time, chronological, plus their average download. */
function chartData(entries) {
  const sorted = (entries || []).slice().sort(byDateTime).slice(-14);
  const bars = sorted.map((e) => ({ label: e.date.slice(5), down: Number(e.download) }));
  return { bars: bars, avgDown: avgMilli(sorted.map((e) => e.download)) };
}

function filterEntries(entries, f) {
  const opts = f || {};
  return (entries || []).filter((e) => {
    if (opts.isp && opts.isp !== 'all' && e.isp !== opts.isp) return false;
    if (opts.type && opts.type !== 'all' && e.type !== opts.type) return false;
    if (opts.period === '7' && !inWindow(e, opts.today, 6, 0)) return false;
    if (opts.period === '30' && !inWindow(e, opts.today, 29, 0)) return false;
    return true;
  });
}

function todayStrLocal() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

/* Strict import: parsed must be an array of valid entries with unique string ids.
 * Returns {ok:true, entries:[...]} or {ok:false, errors:[...]}. */
function validateImport(parsed, today) {
  const t = today || todayStrLocal();
  if (!Array.isArray(parsed)) return { ok: false, errors: ['notArray'] };
  if (parsed.length > MAX_ENTRIES) return { ok: false, errors: ['tooMany'] };
  const errors = [];
  const seen = new Set();
  const entries = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push('item'); continue; }
    if (typeof item.id !== 'string' || !item.id) { errors.push('id'); continue; }
    if (seen.has(item.id)) { errors.push('duplicateId'); continue; }
    seen.add(item.id);
    const errs = validateEntry(item, t);
    if (errs.length) { errs.forEach((k) => { if (!errors.includes(k)) errors.push(k); }); continue; }
    entries.push({
      id: item.id,
      date: item.date,
      time: item.time,
      isp: item.isp.trim(),
      type: item.type,
      download: Number(item.download),
      upload: Number(item.upload),
      ping: Number(item.ping),
    });
  }
  if (errors.length) return { ok: false, errors: errors };
  return { ok: true, entries: entries };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, MAX_ENTRIES, toBnDigits, isValidDate, isValidTime,
    parseDate, daysBetween, fmt1, round1, newId, cleanStr, isSpeed, isPing,
    validateEntry, qualityBadge, stats, perIsp, chartData, filterEntries,
    validateImport, byDateTime };
}
