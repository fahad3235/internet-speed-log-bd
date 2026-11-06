/* Node unit tests for internet-speed-log-bd logic. Run: node tests/logic.test.js */
'use strict';
const assert = require('node:assert');
const L = require('../logic.js');

let n = 0;
function check(name, fn) { n++; fn(); console.log('ok ' + n + ' - ' + name); }

const TODAY = '2026-11-06';
const good = { id: 'e1', date: '2026-11-06', time: '14:30', isp: 'Grameenphone',
  type: 'Mobile 4G', download: 42.5, upload: 18.2, ping: 28 };

check('valid entry passes', () => {
  assert.deepStrictEqual(L.validateEntry(good, TODAY), []);
});
check('download boundaries: 0 rejected, 0.1 ok, 10000 ok, 10001 rejected', () => {
  assert.ok(L.validateEntry({ ...good, download: 0 }, TODAY).includes('download'));
  assert.deepStrictEqual(L.validateEntry({ ...good, download: 0.1 }, TODAY), []);
  assert.deepStrictEqual(L.validateEntry({ ...good, download: 10000 }, TODAY), []);
  assert.ok(L.validateEntry({ ...good, download: 10001 }, TODAY).includes('download'));
  assert.ok(L.validateEntry({ ...good, download: 'fast' }, TODAY).includes('download'));
});
check('upload boundaries: 0 rejected, 10001 rejected', () => {
  assert.ok(L.validateEntry({ ...good, upload: 0 }, TODAY).includes('upload'));
  assert.ok(L.validateEntry({ ...good, upload: 10001 }, TODAY).includes('upload'));
});
check('ping boundaries: 0 rejected, 1 ok, 2000 ok, 2001 rejected, 28.5 rejected', () => {
  assert.ok(L.validateEntry({ ...good, ping: 0 }, TODAY).includes('ping'));
  assert.deepStrictEqual(L.validateEntry({ ...good, ping: 1 }, TODAY), []);
  assert.deepStrictEqual(L.validateEntry({ ...good, ping: 2000 }, TODAY), []);
  assert.ok(L.validateEntry({ ...good, ping: 2001 }, TODAY).includes('ping'));
  assert.ok(L.validateEntry({ ...good, ping: 28.5 }, TODAY).includes('ping'));
});
check('future date rejected; today ok; yesterday ok; invalid date rejected', () => {
  assert.ok(L.validateEntry({ ...good, date: '2026-11-07' }, TODAY).includes('date'));
  assert.deepStrictEqual(L.validateEntry({ ...good, date: '2026-11-06' }, TODAY), []);
  assert.deepStrictEqual(L.validateEntry({ ...good, date: '2026-11-05' }, TODAY), []);
  assert.ok(L.validateEntry({ ...good, date: '2026-02-30' }, TODAY).includes('date'));
  assert.ok(L.validateEntry({ ...good, date: '06-11-2026' }, TODAY).includes('date'));
});
check('bad time rejected; valid times ok', () => {
  assert.ok(L.validateEntry({ ...good, time: '25:00' }, TODAY).includes('time'));
  assert.ok(L.validateEntry({ ...good, time: '14:60' }, TODAY).includes('time'));
  assert.ok(L.validateEntry({ ...good, time: '2:30' }, TODAY).includes('time'));
  assert.ok(L.validateEntry({ ...good, time: '' }, TODAY).includes('time'));
  assert.deepStrictEqual(L.validateEntry({ ...good, time: '00:00' }, TODAY), []);
  assert.deepStrictEqual(L.validateEntry({ ...good, time: '23:59' }, TODAY), []);
});
check('empty ISP rejected; over-long ISP rejected; bad type rejected', () => {
  assert.ok(L.validateEntry({ ...good, isp: '   ' }, TODAY).includes('isp'));
  assert.ok(L.validateEntry({ ...good, isp: '' }, TODAY).includes('isp'));
  assert.ok(L.validateEntry({ ...good, isp: 'x'.repeat(61) }, TODAY).includes('isp'));
  assert.ok(L.validateEntry({ ...good, type: 'Dial-up' }, TODAY).includes('type'));
  assert.deepStrictEqual(L.validateEntry({ ...good, type: 'Wi-Fi hotspot' }, TODAY), []);
  assert.ok(L.validateEntry(null, TODAY).includes('entry'));
});

check('qualityBadge: all four bands', () => {
  assert.strictEqual(L.qualityBadge(85, 12), 'excellent');
  assert.strictEqual(L.qualityBadge(50, 28), 'excellent');
  assert.strictEqual(L.qualityBadge(42.5, 28), 'good');
  assert.strictEqual(L.qualityBadge(30, 45), 'good');
  assert.strictEqual(L.qualityBadge(10, 100), 'fair');
  assert.strictEqual(L.qualityBadge(3, 200), 'slow');
  assert.strictEqual(L.qualityBadge(100, 200), 'slow');
});
check('qualityBadge boundaries: 50/30 excellent, 49.9 good, 20/60 good, 5/120 fair, 4.9 slow', () => {
  assert.strictEqual(L.qualityBadge(50, 30), 'excellent');
  assert.strictEqual(L.qualityBadge(50, 31), 'good');
  assert.strictEqual(L.qualityBadge(49.9, 30), 'good');
  assert.strictEqual(L.qualityBadge(20, 60), 'good');
  assert.strictEqual(L.qualityBadge(20, 61), 'fair');
  assert.strictEqual(L.qualityBadge(5, 120), 'fair');
  assert.strictEqual(L.qualityBadge(5, 121), 'slow');
  assert.strictEqual(L.qualityBadge(4.9, 10), 'slow');
});

const two = [
  { ...good, id: 'a', date: '2026-11-06', time: '10:00', isp: 'Grameenphone', type: 'Mobile 4G', download: 42.5, upload: 18.2, ping: 28 },
  { ...good, id: 'b', date: '2026-11-06', time: '11:00', isp: 'Link3', type: 'Broadband', download: 85, upload: 40, ping: 12 },
];
check('stats: avg/median/best for 2 entries; bestIsp needs >=2 so null', () => {
  const s = L.stats(two, TODAY);
  assert.strictEqual(s.total, 2);
  assert.strictEqual(s.avgDown, 63.8);
  assert.strictEqual(s.medianDown, 63.8);
  assert.strictEqual(s.bestDown, 85);
  assert.strictEqual(s.avgUp, 29.1);
  assert.strictEqual(s.avgPing, 20);
  assert.strictEqual(s.trendPct, null);
  assert.strictEqual(s.trend, null);
  assert.strictEqual(s.bestIsp, null);
});
check('stats: median odd count is middle value', () => {
  const three = [...two, { ...good, id: 'c', date: '2026-11-06', time: '12:00', isp: 'Robi', type: 'Mobile 4G', download: 10, upload: 5, ping: 60 }];
  assert.strictEqual(L.stats(three, TODAY).medianDown, 42.5);
});
check('stats: empty list returns nulls and total 0', () => {
  const s = L.stats([], TODAY);
  assert.deepStrictEqual(s, { total: 0, avgDown: null, medianDown: null, bestDown: null,
    avgUp: null, avgPing: null, trendPct: null, trend: null, bestIsp: null });
});
check('stats: trend up when this week beats last week', () => {
  const entries = [
    { ...good, id: 'p1', date: '2026-10-30', time: '10:00', download: 20, upload: 10, ping: 50 },
    { ...good, id: 'c1', date: '2026-11-06', time: '10:00', download: 40, upload: 10, ping: 50 },
  ];
  const s = L.stats(entries, TODAY);
  assert.strictEqual(s.trendPct, 100);
  assert.strictEqual(s.trend, 'up');
});
check('stats: trend down and flat', () => {
  const down = [
    { ...good, id: 'p1', date: '2026-10-30', time: '10:00', download: 40, upload: 10, ping: 50 },
    { ...good, id: 'c1', date: '2026-11-06', time: '10:00', download: 20, upload: 10, ping: 50 },
  ];
  const s1 = L.stats(down, TODAY);
  assert.strictEqual(s1.trendPct, -50);
  assert.strictEqual(s1.trend, 'down');
  const flat = down.map((e, i) => ({ ...e, id: 'f' + i, download: 30 }));
  const s2 = L.stats(flat, TODAY);
  assert.strictEqual(s2.trendPct, 0);
  assert.strictEqual(s2.trend, 'flat');
});
check('stats: bestIsp is highest avg down among ISPs with >=2 tests', () => {
  const entries = [
    { ...good, id: '1', date: '2026-11-06', time: '10:00', isp: 'Link3', download: 80, upload: 30, ping: 10 },
    { ...good, id: '2', date: '2026-11-06', time: '11:00', isp: 'Link3', download: 90, upload: 30, ping: 10 },
    { ...good, id: '3', date: '2026-11-06', time: '12:00', isp: 'Grameenphone', download: 100, upload: 30, ping: 10 },
    { ...good, id: '4', date: '2026-11-06', time: '13:00', isp: 'Grameenphone', download: 40, upload: 30, ping: 10 },
  ];
  assert.strictEqual(L.stats(entries, TODAY).bestIsp, 'Link3');
});

check('perIsp sorts by avg down desc with counts and best', () => {
  const entries = [
    { ...good, id: '1', isp: 'Robi', download: 10, upload: 5, ping: 80 },
    { ...good, id: '2', isp: 'Link3', download: 80, upload: 30, ping: 10 },
    { ...good, id: '3', isp: 'Link3', download: 100, upload: 40, ping: 12 },
  ];
  const rows = L.perIsp(entries);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].isp, 'Link3');
  assert.strictEqual(rows[0].count, 2);
  assert.strictEqual(rows[0].avgDown, 90);
  assert.strictEqual(rows[0].bestDown, 100);
  assert.strictEqual(rows[0].avgUp, 35);
  assert.strictEqual(rows[0].avgPing, 11);
  assert.strictEqual(rows[1].isp, 'Robi');
  assert.strictEqual(L.perIsp([]).length, 0);
});

check('filterEntries: ISP, type and period filters', () => {
  const entries = [
    { ...good, id: '1', date: '2026-11-06', isp: 'Link3', type: 'Broadband' },
    { ...good, id: '2', date: '2026-11-01', isp: 'Link3', type: 'Mobile 4G' },
    { ...good, id: '3', date: '2026-10-01', isp: 'Robi', type: 'Mobile 4G' },
  ];
  assert.strictEqual(L.filterEntries(entries, { isp: 'Link3', type: 'all', period: 'all', today: TODAY }).length, 2);
  assert.strictEqual(L.filterEntries(entries, { isp: 'all', type: 'Mobile 4G', period: 'all', today: TODAY }).length, 2);
  assert.strictEqual(L.filterEntries(entries, { isp: 'all', type: 'all', period: '7', today: TODAY }).length, 2);
  assert.strictEqual(L.filterEntries(entries, { isp: 'all', type: 'all', period: '30', today: TODAY }).length, 2);
  assert.strictEqual(L.filterEntries(entries, { isp: 'Link3', type: 'Broadband', period: '7', today: TODAY }).length, 1);
  assert.strictEqual(L.filterEntries(entries, { isp: 'all', type: 'all', period: 'all', today: TODAY }).length, 3);
});

check('validateImport: valid round-trip', () => {
  const res = L.validateImport(JSON.parse(JSON.stringify(two)), TODAY);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.entries.length, 2);
  assert.strictEqual(res.entries[0].download, 42.5);
});
check('validateImport: non-array rejected', () => {
  assert.strictEqual(L.validateImport({ entries: [] }, TODAY).ok, false);
  assert.ok(L.validateImport({ entries: [] }, TODAY).errors.includes('notArray'));
  assert.strictEqual(L.validateImport('nope', TODAY).ok, false);
  assert.strictEqual(L.validateImport(null, TODAY).ok, false);
});
check('validateImport: missing field and bad value rejected', () => {
  const missing = [{ ...good }]; delete missing[0].ping;
  assert.strictEqual(L.validateImport(missing, TODAY).ok, false);
  assert.ok(L.validateImport(missing, TODAY).errors.includes('ping'));
  const bad = [{ ...good, download: 0 }];
  assert.strictEqual(L.validateImport(bad, TODAY).ok, false);
  assert.ok(L.validateImport(bad, TODAY).errors.includes('download'));
});
check('validateImport: duplicate id and missing id rejected', () => {
  assert.ok(L.validateImport([{ ...good }, { ...good }], TODAY).errors.includes('duplicateId'));
  const noId = [{ ...good }]; delete noId[0].id;
  assert.ok(L.validateImport(noId, TODAY).errors.includes('id'));
});
check('validateImport: over 5000 entries rejected', () => {
  const big = [];
  for (let i = 0; i < 5001; i++) big.push({ ...good, id: 'x' + i });
  const res = L.validateImport(big, TODAY);
  assert.strictEqual(res.ok, false);
  assert.ok(res.errors.includes('tooMany'));
});

check('chartData: last 14 cap and chronological order', () => {
  const entries = [];
  for (let i = 0; i < 20; i++) {
    entries.push({ ...good, id: 'c' + i, date: '2026-10-' + String(10 + i).padStart(2, '0'),
      time: '10:00', download: 10 + i });
  }
  const cd = L.chartData(entries);
  assert.strictEqual(cd.bars.length, 14);
  assert.strictEqual(cd.bars[0].label, '10-16');
  assert.strictEqual(cd.bars[13].label, '10-29');
  assert.strictEqual(cd.bars[13].down, 29);
  assert.strictEqual(cd.avgDown, 22.5);
  assert.deepStrictEqual(L.chartData([]), { bars: [], avgDown: null });
});

check('toBnDigits converts 0-9', () => {
  assert.strictEqual(L.toBnDigits('2026-11-06'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e7-\u09e6\u09ec');
  assert.strictEqual(L.toBnDigits('42.5 Mbps'), '\u09ea\u09e8.\u09eb Mbps');
});
check('fmt1 rounds to one decimal', () => {
  assert.strictEqual(L.fmt1(42.55), '42.6');
  assert.strictEqual(L.fmt1(42), '42.0');
  assert.strictEqual(L.fmt1(null), '');
});
check('parseDate and daysBetween', () => {
  assert.ok(L.parseDate('2026-11-06') instanceof Date);
  assert.strictEqual(L.parseDate('2026-02-30'), null);
  assert.strictEqual(L.daysBetween('2026-10-30', '2026-11-06'), 7);
  assert.strictEqual(L.daysBetween('2026-11-06', '2026-11-06'), 0);
});

console.log('ALL ' + n + ' UNIT TESTS PASSED');
