/* Internet Speed Log BD - UI. State in localStorage; logic in logic.js; strings in i18n.js.
 * Pure ASCII source: all Bengali text comes from the I18N dictionary. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DATA_KEY = 'internet-speed-log-bd-v1';
  var LANG_KEY = 'internet-speed-log-bd-lang';

  var lang = localStorage.getItem(LANG_KEY) || 'en';
  if (lang !== 'en' && lang !== 'bn') lang = 'en';
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) return { entries: [] };
      var d = JSON.parse(raw);
      var res = validateImport(d, todayStr());
      if (!res.ok) return { entries: [] };
      return { entries: res.entries };
    } catch (e) { return { entries: [] }; }
  }
  function save() { localStorage.setItem(DATA_KEY, JSON.stringify(state.entries)); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function nowTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fmt(s) { return lang === 'bn' ? toBnDigits(s) : s; }
  function fmtNum(n) { return n === null || n === undefined ? '-' : fmt(fmt1(n)); }
  function fmtDate(s) { return fmt(s); }
  function fmtTime(s) { return fmt(s); }
  function t(k) { return I18N[lang][k]; }

  function showMsg(el, text, ok) {
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'err');
    el.style.display = 'block';
  }

  function typeLabel(type) {
    if (type === 'Broadband') return t('typeBroadband');
    if (type === 'Mobile 4G') return t('type4g');
    if (type === 'Mobile 5G') return t('type5g');
    return t('typeHotspot');
  }

  function badgeLabel(b) {
    if (b === 'excellent') return t('badgeExcellent');
    if (b === 'good') return t('badgeGood');
    if (b === 'fair') return t('badgeFair');
    return t('badgeSlow');
  }

  function applyLang() {
    var map = { appTitle: 'appTitle', tagline: 'tagline', langBtn: 'langBtn',
      lblTotal: 'lblTotal', lblAvgDown: 'lblAvgDown', lblMedianDown: 'lblMedianDown',
      lblBestDown: 'lblBestDown', lblAvgUp: 'lblAvgUp', lblAvgPing: 'lblAvgPing',
      lblTrend: 'lblTrend', lblBestIsp: 'lblBestIsp', hAdd: 'hAdd',
      lblDate: 'lblDate', lblTime: 'lblTime', lblIsp: 'lblIsp', lblType: 'lblType',
      lblDown: 'lblDown', lblUp: 'lblUp', lblPing: 'lblPing', addBtn: 'addBtn',
      hChart: 'hChart', chartEmpty: 'chartEmpty', hHistory: 'hHistory',
      historyEmpty: 'historyEmpty', hCompare: 'hCompare', compareEmpty: 'compareEmpty',
      colIsp: 'colIsp', colTests: 'colTests', colAvgDown: 'colAvgDown',
      colAvgUp: 'colAvgUp', colAvgPing: 'colAvgPing', colBestDown: 'colBestDown',
      hData: 'hData', dataIntro: 'dataIntro', exportBtn: 'exportBtn',
      importLbl: 'importLbl', hErase: 'hErase', eraseIntro: 'eraseIntro',
      eraseBtn: 'eraseBtn', footerNote: 'footerNote', qualityNote: 'qualityNote' };
    Object.keys(map).forEach(function (id) { $(id).textContent = t(map[id]); });
    $('entryIsp').placeholder = t('ispPh');
    $('filterType').options[0].textContent = t('fTypeAll');
    $('filterPeriod').options[0].textContent = t('fPeriodAll');
    $('filterPeriod').options[1].textContent = t('fPeriod7');
    $('filterPeriod').options[2].textContent = t('fPeriod30');
    var typeSel = $('entryType');
    typeSel.options[0].textContent = t('typeBroadband');
    typeSel.options[1].textContent = t('type4g');
    typeSel.options[2].textContent = t('type5g');
    typeSel.options[3].textContent = t('typeHotspot');
    var fType = $('filterType');
    fType.options[1].textContent = t('typeBroadband');
    fType.options[2].textContent = t('type4g');
    fType.options[3].textContent = t('type5g');
    fType.options[4].textContent = t('typeHotspot');
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }

  function render() {
    var today = todayStr();
    var st = stats(state.entries, today);
    $('statTotal').textContent = fmt(String(st.total));
    $('statAvgDown').textContent = fmtNum(st.avgDown);
    $('statMedianDown').textContent = fmtNum(st.medianDown);
    $('statBestDown').textContent = fmtNum(st.bestDown);
    $('statAvgUp').textContent = fmtNum(st.avgUp);
    $('statAvgPing').textContent = fmtNum(st.avgPing);
    if (st.trend === null || st.trendPct === null) {
      $('statTrend').textContent = t('trendNone');
    } else {
      var sign = st.trendPct > 0 ? '+' : '';
      var lbl = st.trend === 'up' ? t('trendUp') : (st.trend === 'down' ? t('trendDown') : t('trendFlat'));
      $('statTrend').textContent = fmt(sign + fmt1(st.trendPct) + '% ') + lbl;
    }
    $('statBestIsp').textContent = st.bestIsp ? st.bestIsp : t('noBestIsp');
    renderChart();
    renderHistory(today);
    renderCompare();
    renderIspFilter();
  }

  function renderIspFilter() {
    var sel = $('filterIsp');
    var cur = sel.value || 'all';
    var isps = [];
    state.entries.forEach(function (e) {
      if (isps.indexOf(e.isp) === -1) isps.push(e.isp);
    });
    isps.sort();
    sel.innerHTML = '';
    var all = document.createElement('option');
    all.value = 'all'; all.textContent = t('fIspAll'); sel.appendChild(all);
    isps.forEach(function (isp) {
      var o = document.createElement('option'); o.value = isp; o.textContent = isp; sel.appendChild(o);
    });
    sel.value = isps.indexOf(cur) === -1 ? 'all' : cur;
  }

  function renderChart() {
    var box = $('chartBox');
    box.innerHTML = '';
    var cd = chartData(state.entries);
    $('chartEmpty').style.display = cd.bars.length ? 'none' : 'block';
    if (!cd.bars.length) return;
    var W = 360, H = 170, padL = 34, padB = 22, padT = 12;
    var max = Math.max.apply(null, cd.bars.map(function (b) { return b.down; }).concat([cd.avgDown || 0, 1]));
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    var plotW = W - padL - 8;
    var plotH = H - padT - padB;
    var slot = plotW / cd.bars.length;
    var barW = Math.max(4, Math.min(28, slot * 0.6));
    cd.bars.forEach(function (b, i) {
      var h = (b.down / max) * plotH;
      var x = padL + i * slot + (slot - barW) / 2;
      var y = padT + plotH - h;
      var rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', x.toFixed(1)); rect.setAttribute('y', y.toFixed(1));
      rect.setAttribute('width', barW.toFixed(1)); rect.setAttribute('height', Math.max(h, 1).toFixed(1));
      rect.setAttribute('fill', '#0f766e'); rect.setAttribute('rx', '2');
      svg.appendChild(rect);
      var lbl = document.createElementNS(svgNS, 'text');
      lbl.setAttribute('x', (x + barW / 2).toFixed(1));
      lbl.setAttribute('y', (H - 6).toFixed(1));
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-size', '9');
      lbl.setAttribute('fill', '#6b7280');
      lbl.textContent = fmt(b.label);
      svg.appendChild(lbl);
    });
    if (cd.avgDown !== null) {
      var ay = padT + plotH - (cd.avgDown / max) * plotH;
      var line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', padL); line.setAttribute('x2', W - 8);
      line.setAttribute('y1', ay.toFixed(1)); line.setAttribute('y2', ay.toFixed(1));
      line.setAttribute('stroke', '#b91c1c'); line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(line);
      var avgLbl = document.createElementNS(svgNS, 'text');
      avgLbl.setAttribute('x', padL + 2);
      avgLbl.setAttribute('y', Math.max(ay - 4, 10).toFixed(1));
      avgLbl.setAttribute('font-size', '10');
      avgLbl.setAttribute('fill', '#b91c1c');
      avgLbl.textContent = t('chartAvg') + ': ' + fmt(fmt1(cd.avgDown));
      svg.appendChild(avgLbl);
    }
    box.appendChild(svg);
  }

  function renderHistory(today) {
    var list = $('historyList');
    list.innerHTML = '';
    var shown = filterEntries(state.entries, {
      isp: $('filterIsp').value || 'all',
      type: $('filterType').value || 'all',
      period: $('filterPeriod').value || 'all',
      today: today,
    });
    shown.sort(function (a, b) { return byDateTime(b, a); });
    $('historyEmpty').style.display = shown.length ? 'none' : 'block';
    shown.forEach(function (e) {
      var li = document.createElement('li'); li.className = 'item';
      var left = document.createElement('div');
      var ttl = document.createElement('b');
      ttl.textContent = e.isp + ' - ' + typeLabel(e.type);
      left.appendChild(ttl);
      var meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = fmtDate(e.date) + ' ' + fmtTime(e.time) + '  |  ' +
        t('downLbl') + ' ' + fmt(fmt1(e.download)) + ' Mbps  |  ' +
        t('upLbl') + ' ' + fmt(fmt1(e.upload)) + ' Mbps  |  ' +
        t('pingLbl') + ' ' + fmt(String(e.ping)) + ' ms';
      left.appendChild(meta);
      var badge = document.createElement('span');
      var b = qualityBadge(e.download, e.ping);
      badge.className = 'badge ' + b;
      badge.textContent = badgeLabel(b);
      left.appendChild(badge);
      var right = document.createElement('div');
      var del = document.createElement('button');
      del.className = 'btn small secondary'; del.type = 'button';
      del.textContent = t('deleteBtn');
      del.onclick = function () {
        if (!window.confirm(t('confirmDelete'))) return;
        state.entries = state.entries.filter(function (x) { return x.id !== e.id; });
        save(); render(); showMsg($('entryMsg'), t('deleted'), true);
      };
      right.appendChild(del);
      li.appendChild(left); li.appendChild(right); list.appendChild(li);
    });
  }

  function renderCompare() {
    var rows = perIsp(state.entries);
    $('compareEmpty').style.display = rows.length ? 'none' : 'block';
    $('compareTable').style.display = rows.length ? 'table' : 'none';
    var body = $('compareBody');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.isp, String(r.count), fmt(fmt1(r.avgDown)), fmt(fmt1(r.avgUp)),
       fmt(fmt1(r.avgPing)), fmt(fmt1(r.bestDown))].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  $('langBtn').onclick = function () {
    lang = lang === 'en' ? 'bn' : 'en';
    localStorage.setItem(LANG_KEY, lang);
    applyLang(); render();
  };
  $('filterIsp').onchange = render;
  $('filterType').onchange = render;
  $('filterPeriod').onchange = render;

  $('entryForm').onsubmit = function (ev) {
    ev.preventDefault();
    var entry = {
      id: newId(),
      date: $('entryDate').value,
      time: $('entryTime').value,
      isp: $('entryIsp').value.trim(),
      type: $('entryType').value,
      download: $('entryDown').value === '' ? NaN : Number($('entryDown').value),
      upload: $('entryUp').value === '' ? NaN : Number($('entryUp').value),
      ping: $('entryPing').value === '' ? NaN : Number($('entryPing').value),
    };
    var errs = validateEntry(entry, todayStr());
    if (errs.length) {
      var key = errs[0];
      var msg = key === 'date' ? t('errDate') : key === 'time' ? t('errTime') :
        key === 'isp' ? t('errIsp') : key === 'type' ? t('errType') :
        key === 'download' ? t('errDown') : key === 'upload' ? t('errUp') : t('errPing');
      showMsg($('entryMsg'), msg, false);
      return;
    }
    state.entries.push(entry); save();
    $('entryForm').reset();
    $('entryDate').value = todayStr();
    $('entryTime').value = nowTime();
    render(); showMsg($('entryMsg'), t('added'), true);
  };

  $('exportBtn').onclick = function () {
    var blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'internet-speed-log-bd-backup.json';
    a.click();
    showMsg($('dataMsg'), t('exported'), true);
  };
  $('importFile').onchange = function () {
    var f = $('importFile').files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        var res = validateImport(d, todayStr());
        if (!res.ok) throw new Error('bad');
        state = { entries: res.entries }; save(); render();
        showMsg($('dataMsg'), t('imported'), true);
      } catch (e) { showMsg($('dataMsg'), t('importBad'), false); }
    };
    r.readAsText(f);
    $('importFile').value = '';
  };
  $('eraseBtn').onclick = function () {
    if ($('eraseInput').value !== 'DELETE') { showMsg($('eraseMsg'), t('eraseNeed'), false); return; }
    state = { entries: [] }; save();
    $('eraseInput').value = '';
    render(); showMsg($('eraseMsg'), t('erased'), true);
  };

  $('entryDate').value = todayStr();
  $('entryDate').max = todayStr();
  $('entryTime').value = nowTime();
  applyLang();
  render();
})();
