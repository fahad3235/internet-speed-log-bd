/* Headless-Chrome smoke test for internet-speed-log-bd via raw CDP.
 * Run: node tests/smoke.mjs
 * NOTE: the task brief's smoke line says the 42.5 Mbps entry should show an
 * "Excellent" badge, but the threshold spec says Excellent needs >= 50 Mbps
 * down, so 42.5 Mbps is correctly Good; the 85 Mbps entry is Excellent.
 * This test asserts the threshold-correct badges. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PORT = 9338;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.resolve(DIR, '..', 'index.html');

let n = 0, failures = [];
function check(name, cond, extra = '') {
  n++;
  if (cond) console.log('ok ' + n + ' - ' + name);
  else { console.log('FAIL ' + n + ' - ' + name + ' ' + extra); failures.push(name); }
}

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/speedlog-smoke-profile', 'about:blank'],
  { stdio: 'ignore' });

async function waitForList() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list'); if (r.ok) return; } catch (e) {}
    await sleep(500);
  }
  throw new Error('chrome debug port never came up');
}

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [], pageExceptions = [];
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evalJs(expression) {
  return send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    .then((m) => m.result.result);
}

try {
  await waitForList();
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' })).json();
  ws = new WebSocket(tabs.webSocketDebuggerUrl);
  await new Promise((res) => { ws.onopen = res; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      consoleErrors.push(JSON.stringify(m.params.args));
    if (m.method === 'Runtime.exceptionThrown') pageExceptions.push(m.params.exceptionDetails.exception?.description || 'exception');
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(1200);
  // start from a clean slate
  await evalJs(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);

  const r = await evalJs(`(async () => {
    const out = {};
    const $ = (id) => document.getElementById(id);
    const submit = (form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    window.confirm = () => true;
    // 1. valid entry: Grameenphone, Mobile 4G, 2026-11-06, 42.5 / 18.2 / 28
    $('entryDate').value = '2026-11-06'; $('entryTime').value = '14:30';
    $('entryIsp').value = 'Grameenphone'; $('entryType').value = 'Mobile 4G';
    $('entryDown').value = '42.5'; $('entryUp').value = '18.2'; $('entryPing').value = '28';
    submit($('entryForm'));
    out.rows1 = $('historyList').querySelectorAll('li').length;
    out.total1 = $('statTotal').textContent;
    out.avgDown1 = $('statAvgDown').textContent;
    out.row1Text = $('historyList').querySelector('li') ? $('historyList').querySelector('li').textContent : '';
    // 2. invalid entry: download 0 -> error, count unchanged
    $('entryDate').value = '2026-11-06'; $('entryTime').value = '15:00';
    $('entryIsp').value = 'Robi'; $('entryType').value = 'Mobile 4G';
    $('entryDown').value = '0'; $('entryUp').value = '10'; $('entryPing').value = '30';
    submit($('entryForm'));
    out.errDown = $('entryMsg').style.display === 'block' && $('entryMsg').className.includes('err');
    out.rows2 = $('historyList').querySelectorAll('li').length;
    // 3. second entry: Link3, Broadband, 85 / 40 / 12
    $('entryDate').value = '2026-11-06'; $('entryTime').value = '16:00';
    $('entryIsp').value = 'Link3'; $('entryType').value = 'Broadband';
    $('entryDown').value = '85'; $('entryUp').value = '40'; $('entryPing').value = '12';
    submit($('entryForm'));
    out.rows3 = $('historyList').querySelectorAll('li').length;
    out.bestIsp = $('statBestIsp').textContent;
    const cmpRows = [...$('compareBody').querySelectorAll('tr')];
    out.compareTop = cmpRows.length ? cmpRows[0].textContent : '';
    out.bars = $('chartBox').querySelectorAll('svg rect').length;
    out.avgLine = !!$('chartBox').querySelector('svg line');
    const rows = [...$('historyList').querySelectorAll('li')];
    const link3Row = rows.find((li) => li.textContent.includes('Link3'));
    out.link3Excellent = link3Row ? link3Row.textContent.includes('Excellent') : false;
    // 4. filter by ISP Link3 narrows to 1 row
    $('filterIsp').value = 'Link3';
    $('filterIsp').dispatchEvent(new Event('change', { bubbles: true }));
    out.filteredRows = $('historyList').querySelectorAll('li').length;
    $('filterIsp').value = 'all';
    $('filterIsp').dispatchEvent(new Event('change', { bubbles: true }));
    out.rowsBack = $('historyList').querySelectorAll('li').length;
    // 5. export produces JSON containing both entries
    let captured = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { captured = b; return orig(b); };
    $('exportBtn').click();
    out.exportText = captured ? await new Response(captured).text() : '';
    // 6. BN toggle: Bengali title + Bengali digits (total 2 -> 2 in Bengali)
    $('langBtn').click();
    out.bnTitle = $('appTitle').textContent;
    out.bnTotal = $('statTotal').textContent;
    $('langBtn').click();
    out.enTitle = $('appTitle').textContent;
    // 7. delete the Link3 row
    const rows2 = [...$('historyList').querySelectorAll('li')];
    const l3 = rows2.find((li) => li.textContent.includes('Link3'));
    [...l3.querySelectorAll('button')].find((b) => b.textContent.includes('Delete')).click();
    out.rowsAfterDelete = $('historyList').querySelectorAll('li').length;
    out.totalAfterDelete = $('statTotal').textContent;
    out.persistKey = !!localStorage.getItem('internet-speed-log-bd-v1');
    return out;
  })()`);
  if (r.subtype === 'error') throw new Error('page eval error: ' + r.description);
  const o = r.value;
  check('entry 1 added: 1 row, total 1', o.rows1 === 1 && o.total1 === '1', JSON.stringify(o));
  check('avg download shows 42.5', o.avgDown1 === '42.5', 'got ' + o.avgDown1);
  check('entry 1 badge is Good (42.5 Mbps < 50 Excellent threshold)', o.row1Text.includes('Good'), 'row: ' + o.row1Text);
  check('invalid download 0 rejected with error, count stays 1', o.errDown && o.rows2 === 1, JSON.stringify(o));
  check('entry 2 added: 2 rows; comparison table ranks Link3 first (best ISP)', o.rows3 === 2 && o.compareTop.includes('Link3'), JSON.stringify(o));
  check('best-ISP stat correctly shows none yet (needs >=2 tests per ISP)', o.bestIsp === '-', 'got ' + o.bestIsp);
  check('chart has 2 bars + dashed average line', o.bars === 2 && o.avgLine === true, 'bars=' + o.bars + ' line=' + o.avgLine);
  check('entry 2 badge is Excellent (85 Mbps, ping 12)', o.link3Excellent === true, JSON.stringify(o));
  check('ISP filter Link3 narrows to 1 row, reset restores 2', o.filteredRows === 1 && o.rowsBack === 2, JSON.stringify(o));
  check('export JSON contains both entries', o.exportText.includes('Grameenphone') && o.exportText.includes('Link3') && o.exportText.includes('42.5'), o.exportText.slice(0, 200));
  check('BN toggle renders Bengali title', o.bnTitle && o.bnTitle !== 'Internet Speed Log BD', 'got ' + o.bnTitle);
  check('BN toggle renders Bengali digits (total 2)', o.bnTotal === '\u09e8', 'got ' + o.bnTotal);
  check('EN toggle restores title', o.enTitle === 'Internet Speed Log BD', 'got ' + o.enTitle);
  check('delete removes Link3 row: 1 row, total 1', o.rowsAfterDelete === 1 && o.totalAfterDelete === '1', JSON.stringify(o));
  check('state persisted to localStorage', o.persistKey === true);

  // Reload persistence check
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);
  const r2 = await evalJs(`document.getElementById('statTotal').textContent`);
  check('entry survives reload (total 1)', r2.value === '1', 'got ' + r2.value);

  // 390px mobile: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const r3 = await evalJs(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)`);
  check('390px viewport: no horizontal overflow', r3.value <= 390, 'scrollWidth=' + r3.value);

  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('zero page exceptions', pageExceptions.length === 0, pageExceptions.join(' | '));
} catch (e) {
  console.log('SMOKE ERROR: ' + e.message);
  failures.push('harness: ' + e.message);
} finally {
  try { ws?.close(); } catch (e) {}
  chrome.kill('SIGKILL');
}
console.log(failures.length === 0 ? 'ALL ' + n + ' SMOKE CHECKS PASSED' : failures.length + ' SMOKE FAILURES');
process.exit(failures.length === 0 ? 0 : 1);
