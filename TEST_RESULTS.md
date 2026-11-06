# Internet Speed Log BD — Test Results (built 2026-11-06, 17:00 slot)

## Unit tests — 26/26 pass
`node tests/logic.test.js` — validation boundaries (download 0 / 0.1 / 10000 /
10001 / non-numeric; upload 0 / 10001; ping 0 / 1 / 2000 / 2001 / 28.5;
future date rejected, today/yesterday ok, invalid dates; bad times 25:00 /
14:60 / 2:30; empty and 61-char ISP; bad connection type), qualityBadge all
four bands plus boundaries (50/30 Excellent, 49.9 Good, 20/60 Good, 5/120
Fair, 4.9 Slow), stats (avg 63.8 / median 63.8 even / median 42.5 odd /
best 85 / avg up 29.1 / avg ping 20; empty list nulls; trend +100% up, -50%
down, 0% flat, null with no previous-week data; best ISP Link3 with >= 2
tests, null otherwise), per-ISP sorting (Link3 avg 90 first, best 100),
filters (ISP / type / 7-day / 30-day), strict import (valid round-trip,
non-array, missing ping, bad download, duplicate id, missing id, > 5000
entries), chartData (last-14 cap, chronological order, avg 22.5), Bengali
digits, fmt1, parseDate, daysBetween.

One test-expectation fix during the run (repair cycle 1, test-side only):
the first qualityBadge check expected 42.5 Mbps / ping 28 to be Excellent,
but the threshold spec says Excellent needs >= 50 Mbps, so 42.5 is Good.
The test was corrected; no app code changed.

## Headless-Chrome smoke — 19/19 pass
`node tests/smoke.mjs` (headless_shell-1187 via raw CDP, file:// page) —
entry 1 added (1 row, total 1), avg download 42.5, entry 1 badge Good
(42.5 Mbps < 50 Excellent threshold), invalid download 0 rejected with
error and count unchanged, entry 2 added (2 rows, comparison table ranks
Link3 first), best-ISP stat correctly shows none yet (needs >= 2 tests per
ISP), chart has 2 bars + dashed average line, entry 2 badge Excellent
(85 Mbps, ping 12), ISP filter Link3 narrows to 1 row and reset restores 2,
export JSON contains both entries, BN toggle renders Bengali title + Bengali
digit "২" for total 2, EN toggle restores title, delete removes the Link3
row (1 row, total 1), state persisted to localStorage, entry survives reload
(total 1), 390px viewport no horizontal overflow, 0 console errors,
0 page exceptions. No app bugs; no harness fixes needed.

## ASCII audit
`grep -rP '[^\x00-\x7F]' index.html app.js logic.js i18n.js style.css
tests/logic.test.js tests/smoke.mjs` — zero matches after fixes. Two
repairs: an em dash in the HTML `<title>` replaced with `-`, and Bengali
literals in the two test files replaced with `\uXXXX` escapes. README.md is
UTF-8 by design (Bengali allowed there).

## Manual verification (hand-checked in the smoke flow)
- Grameenphone, Mobile 4G, 2026-11-06 14:30, down 42.5, up 18.2, ping 28
  -> avg download 42.5, Good badge.
- Link3, Broadband, 2026-11-06 16:00, down 85, up 40, ping 12 -> Excellent
  badge, comparison table top row, 2 chart bars.
- Download 0 rejected; delete + reload persistence verified live.
- Note: the brief's smoke line said the 42.5 Mbps entry should show an
  Excellent badge, which contradicts the stated >= 50 Mbps threshold; the
  app follows the threshold spec (Good), and the smoke test asserts the
  threshold-correct badge. Likewise the brief's "best ISP Link3" after the
  second entry is verified via the comparison table (Link3 first by avg
  download); the dashboard best-ISP stat correctly stays empty because no
  ISP has >= 2 tests yet, per the feature spec.
