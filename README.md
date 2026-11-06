# Internet Speed Log BD

A bilingual (English / বাংলা) offline web app that logs **your own** internet
speed-test measurements — download, upload and ping — ISP by ISP, with
dashboard stats, a download-speed chart, ISP comparison, filters, and
JSON backup / restore. It ships empty: no sample entries.

**This app is a LOG, not a speed test.** It never measures anything itself.
You run a test on fast.com, speedtest.net, or your ISP's own app, then enter
the numbers here.

## Problem

Speed varies by ISP, time of day, and connection type, but the numbers vanish
the moment the test page closes. In Bangladesh, where people switch between
mobile data and several broadband ISPs, there is no simple private place to
keep a history of "what speed did I actually get, when, and from whom" —
without signing up for an account or sending data to a server.

## Features

1. **Log-entry form** — date (defaults to today, future dates rejected),
   time (defaults to now), ISP (text input with datalist suggestions:
   Grameenphone, Robi, Banglalink, Teletalk, Link3, Amber IT, BTCL, Carnival
   Internet, Dot Internet, Triangle, KS Network, Mazeda Networks, Sam Online —
   any ISP name can be typed), connection type (Broadband / Mobile 4G /
   Mobile 5G / Wi-Fi hotspot), download Mbps (0.1–10000), upload Mbps
   (0.1–10000), ping ms (1–2000). Every field is validated; invalid input is
   rejected with an inline error and never saved.
2. **Dashboard stats** — total tests, average download, median download, best
   download, average upload, average ping, last-7-days average download vs the
   previous 7 days (trend % with Up / Down / Flat), and best ISP by average
   download (needs at least 2 tests from that ISP).
3. **History list** — newest first, with filters for ISP, connection type, and
   period (All / Last 7 days / Last 30 days). Delete a single entry (with
   confirm). Each row shows date + time, ISP, type, down / up / ping, and a
   quality badge.
4. **SVG bar chart** — download Mbps for the last 14 entries (chronological),
   with a dashed red average line. Empty state when there are no entries.
5. **ISP comparison table** — per ISP: tests, average down, average up,
   average ping, best down. Sorted by average download, best first.
6. **JSON export + strict import** — download a backup file; import rejects
   non-arrays, missing/invalid fields, and duplicate ids (max 5000 entries).
   Erase-all requires typing `DELETE`.
7. **Bilingual EN / বাংলা** — toggle persisted in localStorage; Bengali
   digits (০–৯) in বাংলা mode. Ships empty — no sample entries.

### Quality badges

The badges are this app's own simple labels, **not an official standard**:

| Badge | Rule |
|---|---|
| Excellent | download ≥ 50 Mbps **and** ping ≤ 30 ms |
| Good | download ≥ 20 Mbps **and** ping ≤ 60 ms |
| Fair | download ≥ 5 Mbps **and** ping ≤ 120 ms |
| Slow | anything else |

## Stack

- Pure HTML + CSS + vanilla JavaScript. No libraries, no build step, no
  external requests, no secrets.
- `logic.js` — pure logic (validation, stats, chart data, import), shared by
  the page and the Node tests via a UMD-style `module.exports` guard.
- `i18n.js` — English / বাংলা string dictionary. All app sources are pure
  ASCII: Bengali text is `\uXXXX` escapes in JS (verified with
  `grep -P '[^\x00-\x7F]'` — zero matches on `index.html`, `app.js`,
  `logic.js`, `i18n.js`, `style.css`).
- `localStorage` persistence (`internet-speed-log-bd-v1`).

## Prerequisites

Any modern browser. Node.js (v18+) only for running the tests.

## Install

No install step. Clone the repo and open `index.html` in a browser, or serve
the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Dev commands

```sh
node tests/logic.test.js   # unit tests (26 checks)
node tests/smoke.mjs       # headless-Chrome smoke tests (19 checks)
```

## Env

None. There are no API keys, no backend, and no environment variables.

## Testing

- `tests/logic.test.js` — 26/26 pass. Validation boundaries (download 0 /
  0.1 / 10000 / 10001; ping 0 / 1 / 2000 / 2001 / 28.5; future date; bad time;
  empty and over-long ISP; bad type), qualityBadge all four bands plus
  boundaries, stats (avg / median even + odd / best / trend up / down / flat /
  null / best ISP needs ≥ 2), per-ISP sorting, filters (ISP / type / period),
  strict import (valid round-trip, non-array, missing field, bad value,
  duplicate id, > 5000), chartData last-14 cap + order, Bengali digits,
  `fmt1`, `parseDate`, `daysBetween`.
- `tests/smoke.mjs` — 19/19 pass (headless Chrome via raw CDP, `file://`
  page). Hand-verified scenario: Grameenphone Mobile 4G entry (2026-11-06,
  42.5 / 18.2 Mbps, ping 28) shows avg 42.5 and a Good badge; download 0 is
  rejected with an error and the count stays 1; Link3 Broadband entry (85 /
  40 Mbps, ping 12) ranks Link3 first in the comparison table with an
  Excellent badge and 2 chart bars plus a dashed average line; ISP filter
  narrows to 1 row; export JSON contains both entries; বাংলা toggle shows the
  Bengali title and Bengali digits; delete removes the row; state survives a
  reload; 390px viewport has no horizontal overflow; 0 console errors,
  0 page exceptions.

See [TEST_RESULTS.md](TEST_RESULTS.md) for the full run log.

## Deployment (GitHub Pages)

1. Push the files to the `main` branch of a public repo.
2. Repo → Settings → Pages → Source: **Deploy from a branch**, branch `main`,
   folder `/ (root)`.
3. The site is live at `https://<user>.github.io/internet-speed-log-bd/`.

## Limitations

- **Log only, not a speed test.** The app never measures speed; numbers are
  whatever you type in, so typos are your responsibility.
- Quality bands are the app's own labels, not an official standard.
- Data lives only in the browser's localStorage — clearing browser data
  deletes it. Export a JSON backup to keep it.
- Trend comparison needs entries in the previous 7-day window; otherwise it
  shows "No data".
- Best-ISP stat needs at least 2 tests from that ISP; the comparison table
  still ranks ISPs with a single test.

## Status

Complete MVP. All 7 features implemented; 26/26 unit tests and 19/19 smoke
checks pass. Built 2026-11-06 (MUSE Project Factory, 17:00 slot).
