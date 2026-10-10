(() => {
  'use strict';

  const SECTIONS = window.ZIKIR_SECTIONS;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- Storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('zk.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } }
  };

  const DEFAULTS = { auto: true, mode: 'pagi', fontSize: 26, vibrate: true, autoNext: true, theme: 'ungu' };
  const settings = Object.assign({}, DEFAULTS, store.get('zk.settings', {}));
  const saveSettings = () => store.set('zk.settings', settings);

  let stats = Object.assign({ daily: {}, done: {}, total: 0, best: 0 }, store.get('zk.stats', {}));
  const saveStats = () => store.set('zk.stats', stats);

  // ---------- Helpers ----------
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const toAr = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtArabic = (t) => esc(t).replace(/\{(\d+)\}/g, (_, n) => `<span class="ayah">${toAr(n)}</span>`);
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeMode = () => { const h = new Date().getHours(); return h >= 4 && h < 16 ? 'pagi' : 'petang'; };
  const fmtNum = (n) => n.toLocaleString('ms-MY');
  const DAYS = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];

  function vibrate(p) { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch { /* ignore */ } } }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- State ----------
  let mode = settings.auto ? timeMode() : settings.mode;
  let list = [];
  let idx = 0;
  let counts = {};
  let advanceTimer;

  function buildList() {
    list = [];
    SECTIONS.forEach((s, si) => {
      s.items.forEach((it) => {
        if (it.only && it.only !== mode) return;
        const evening = mode === 'petang' && !!it.petang;
        list.push({ ...it, si, target: it.target || s.count, text: evening ? it.petang : it.ar, evening });
      });
    });
  }

  function loadSession() {
    const s = store.get('zk.sess.' + mode, null);
    if (s && s.day === dayKey()) {
      counts = s.counts || {};
      idx = Math.min(Math.max(0, s.idx || 0), list.length - 1);
    } else {
      counts = {};
      idx = 0;
    }
  }
  const saveSession = () => store.set('zk.sess.' + mode, { day: dayKey(), idx, counts });

  const countOf = (it) => counts[it.id] || 0;
  const isDone = (it) => countOf(it) >= it.target;
  const allDone = () => list.every(isDone);

  // ---------- Render: zikir ----------
  const R = 72, CIRC = 2 * Math.PI * R;
  $('#ringBar').style.strokeDasharray = CIRC;

  function renderSteps(active) {
    const el = $('#steps');
    el.innerHTML = '';
    SECTIONS.forEach((s, si) => {
      const items = list.filter((it) => it.si === si);
      const done = items.length && items.every(isDone);
      if (si > 0) {
        const line = document.createElement('span');
        line.className = 'step-line' + (si <= active ? ' is-done' : '');
        el.appendChild(line);
      }
      const b = document.createElement('button');
      b.className = 'step' + (si === active ? ' is-active' : done ? ' is-done' : '');
      b.textContent = si + 1;
      b.setAttribute('aria-label', `${s.ordinal}: ${s.instr}`);
      b.addEventListener('click', () => {
        const first = list.findIndex((it) => it.si === si && !isDone(it));
        go(first >= 0 ? first : list.findIndex((it) => it.si === si));
      });
      el.appendChild(b);
    });
  }

  function renderRing() {
    const it = list[idx];
    const c = countOf(it);
    const ratio = Math.min(c / it.target, 1);
    $('#ringBar').style.strokeDashoffset = CIRC * (1 - ratio);
    $('#count').textContent = c;
    $('#target').textContent = it.max
      ? (c >= it.target ? `/ ${it.max} (afdal)` : `/ ${it.target}`)
      : (c >= it.target ? 'Selesai ✓' : `/ ${it.target}`);
    $('#tapBtn').classList.toggle('is-complete', c >= it.target);
  }

  function renderProgress() {
    const done = list.filter(isDone).length;
    $('#progressText').textContent = `${idx + 1} / ${list.length}`;
    $('#progressBar').style.width = `${(done / list.length) * 100}%`;
  }

  function renderZikir(dir) {
    const it = list[idx];
    const s = SECTIONS[it.si];
    $('#appTitle').textContent = mode === 'pagi' ? 'Zikir Pagi' : 'Zikir Petang';
    $('#secOrdinal').textContent = s.ordinal;
    $('#secInstr').textContent = s.instr;
    $('#secAr').textContent = s.arHead;
    $('#itemNum').textContent = it.n;

    $('#itemName').textContent = it.name || `Zikir ${it.n}`;

    const tags = [];
    if (it.only === 'pagi') tags.push('<span class="tag gold">Pagi sahaja</span>');
    if (it.only === 'petang') tags.push('<span class="tag gold">Petang sahaja</span>');
    if (it.evening) tags.push('<span class="tag acc">Lafaz petang</span>');
    tags.push(`<span class="tag">${it.target}×</span>`);
    $('#itemTags').innerHTML = tags.join('');

    $('#itemPre').textContent = it.pre || '';
    $('#itemText').innerHTML = fmtArabic(it.text);
    $('#itemNote').textContent = it.note || '';
    $('#cardBody').scrollTop = 0;

    $('#prevBtn').disabled = idx === 0;
    $('#nextBtn').disabled = idx === list.length - 1;

    renderSteps(it.si);
    renderRing();
    renderProgress();

    if (dir) {
      const card = $('#card');
      card.classList.remove('slide-next', 'slide-prev');
      void card.offsetWidth;
      card.classList.add(dir > 0 ? 'slide-next' : 'slide-prev');
    }
    $$('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }

  function go(i) {
    if (i < 0 || i >= list.length || i === idx) return;
    clearTimeout(advanceTimer);
    const dir = i > idx ? 1 : -1;
    idx = i;
    saveSession();
    renderZikir(dir);
  }

  function nextUndone() {
    for (let i = idx + 1; i < list.length; i++) if (!isDone(list[i])) return i;
    for (let i = 0; i < idx; i++) if (!isDone(list[i])) return i;
    return -1;
  }

  // ---------- Counting ----------
  function tap() {
    const it = list[idx];
    const c = countOf(it);
    const limit = it.max || it.target;
    const ring = $('#tapBtn');
    if (c >= limit) {
      ring.classList.remove('shake'); void ring.offsetWidth; ring.classList.add('shake');
      vibrate(8);
      return;
    }
    const nc = c + 1;
    counts[it.id] = nc;
    const today = dayKey();
    stats.daily[today] = (stats.daily[today] || 0) + 1;
    stats.total += 1;
    saveStats();
    saveSession();

    ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse');
    renderRing();
    renderProgress();

    const reachedTarget = nc === it.target;
    if (reachedTarget || nc === limit) vibrate([25, 50, 25]); else vibrate(12);
    if (reachedTarget) renderSteps(it.si);

    if (reachedTarget && it.max) toast('Alhamdulillah! Teruskan hingga 100 kali untuk lebih afdal.');

    const finished = (nc === limit) || (reachedTarget && !it.max);
    if (!finished && !(reachedTarget && it.max && allDone())) return;

    if (allDone()) {
      advanceTimer = setTimeout(complete, 600);
    } else if (settings.autoNext && finished) {
      const n = nextUndone();
      if (n >= 0) advanceTimer = setTimeout(() => go(n), 550);
    }
  }

  function complete() {
    const today = dayKey();
    stats.done[today] = stats.done[today] || {};
    if (!stats.done[today][mode]) {
      stats.done[today][mode] = true;
      stats.best = Math.max(stats.best, streak());
      saveStats();
    }
    $('#doneTitle').textContent = mode === 'pagi' ? 'Zikir pagi selesai' : 'Zikir petang selesai';
    $('.done-sub').textContent = mode === 'pagi'
      ? 'Semoga Allah menerima amalan anda dan memelihara anda sepanjang hari.'
      : 'Semoga Allah menerima amalan anda dan memelihara anda sepanjang malam.';
    $('#doneOverlay').hidden = false;
    vibrate([40, 60, 40, 60, 80]);
  }

  function resetCurrent() {
    const it = list[idx];
    if (!countOf(it)) return;
    delete counts[it.id];
    saveSession();
    renderRing();
    renderProgress();
    renderSteps(it.si);
    toast('Kiraan diset semula');
  }

  function restartSession() {
    counts = {};
    idx = 0;
    saveSession();
    $('#doneOverlay').hidden = true;
    renderZikir(-1);
  }

  function setMode(m) {
    if (m === mode) return;
    clearTimeout(advanceTimer);
    mode = m;
    settings.mode = m;
    saveSettings();
    buildList();
    loadSession();
    $('#doneOverlay').hidden = !allDone();
    renderZikir(1);
    if (currentView === 'list') renderList();
    toast(m === 'pagi' ? 'Zikir Pagi' : 'Zikir Petang');
  }

  // ---------- Streak ----------
  function streak() {
    const has = (d) => { const x = stats.done[dayKey(d)]; return x && (x.pagi || x.petang); };
    const d = new Date();
    if (!has(d)) d.setDate(d.getDate() - 1);
    let n = 0;
    while (has(d)) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- Render: list ----------
  function renderList() {
    $('#listSub').textContent = `${mode === 'pagi' ? 'Zikir Pagi' : 'Zikir Petang'} · klik untuk terus ke zikir`;
    const body = $('#listBody');
    body.innerHTML = '';
    SECTIONS.forEach((s, si) => {
      const items = list.map((it, i) => ({ it, i })).filter(({ it }) => it.si === si);
      if (!items.length) return;
      const g = document.createElement('div');
      g.className = 'group';
      g.innerHTML = `<div class="group-head"><b>${s.ordinal} · ${s.instr}</b><span lang="ar" dir="rtl" style="font-family:var(--font-ar)">${esc(s.arHead)}</span></div><div class="group-items"></div>`;
      const wrap = g.querySelector('.group-items');
      items.forEach(({ it, i }) => {
        const b = document.createElement('button');
        b.className = 'li' + (isDone(it) ? ' is-done' : '') + (i === idx ? ' is-current' : '');
        const plain = it.text.replace(/\{\d+\}/g, '');
        const sub = [it.name, it.only === 'pagi' ? 'Pagi sahaja' : it.only === 'petang' ? 'Petang sahaja' : ''].filter(Boolean).join(' · ');
        b.innerHTML = `<span class="num">${isDone(it) ? '✓' : it.n}</span>
          <span class="li-text"><span class="li-ar" lang="ar">${esc(plain)}</span>${sub ? `<span class="li-sub">${esc(sub)}</span>` : ''}</span>
          <span class="li-count">${countOf(it)}/${it.target}</span>`;
        b.addEventListener('click', () => { showView('zikir'); go(i); });
        wrap.appendChild(b);
      });
      body.appendChild(g);
    });
  }

  // ---------- Render: stats ----------
  function renderStats() {
    const today = new Date();
    $('#stToday').textContent = fmtNum(stats.daily[dayKey()] || 0);
    $('#stTotal').textContent = fmtNum(stats.total);
    const st = streak();
    stats.best = Math.max(stats.best, st);
    $('#stStreak').textContent = `${st} hari`;
    $('#stBest').textContent = `${stats.best} hari`;

    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push(d); }
    const vals = days.map((d) => stats.daily[dayKey(d)] || 0);
    const max = Math.max(1, ...vals);
    $('#weekTotal').textContent = `${fmtNum(vals.reduce((a, b) => a + b, 0))} kiraan`;
    $('#chart').innerHTML = days.map((d, i) => `
      <div class="col${i === 6 ? ' is-today' : ''}">
        <em>${vals[i] ? fmtNum(vals[i]) : ''}</em>
        <i style="height:${Math.max(3, (vals[i] / max) * 100)}%"></i>
        <small>${i === 6 ? 'Kini' : DAYS[d.getDay()]}</small>
      </div>`).join('');

    const sun = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>';
    const moon = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
    $('#sessions').innerHTML = days.map((d, i) => {
      const x = stats.done[dayKey(d)] || {};
      return `<div class="sess"><small>${i === 6 ? 'Kini' : DAYS[d.getDay()]}</small>
        <div class="dot${x.pagi ? ' on' : ''}" title="Pagi">${sun}</div>
        <div class="dot moon-dot${x.petang ? ' on' : ''}" title="Petang">${moon}</div></div>`;
    }).join('');
  }

  // ---------- Settings ----------
  function applySettings() {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.setProperty('--ar-size', settings.fontSize + 'px');
    $('#fontVal').textContent = settings.fontSize + 'px';
    $('#optFont').value = settings.fontSize;
    $('#optAuto').checked = settings.auto;
    $('#optNext').checked = settings.autoNext;
    $('#optVibrate').checked = settings.vibrate;
    $$('#themes button').forEach((b) => b.classList.toggle('is-active', b.dataset.theme === settings.theme));
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]').content = bg || '#120a24';
  }

  $('#optAuto').addEventListener('change', (e) => { settings.auto = e.target.checked; saveSettings(); if (settings.auto) setMode(timeMode()); });
  $('#optNext').addEventListener('change', (e) => { settings.autoNext = e.target.checked; saveSettings(); });
  $('#optVibrate').addEventListener('change', (e) => { settings.vibrate = e.target.checked; saveSettings(); vibrate(20); });
  $('#optFont').addEventListener('input', (e) => { settings.fontSize = +e.target.value; saveSettings(); applySettings(); });
  $$('#themes button').forEach((b) => b.addEventListener('click', () => { settings.theme = b.dataset.theme; saveSettings(); applySettings(); }));
  $('#resetAll').addEventListener('click', () => {
    if (!confirm('Padam semua update dan statistik? Tindakan ini tidak boleh dibatalkan.')) return;
    store.clear();
    stats = { daily: {}, done: {}, total: 0, best: 0 };
    counts = {};
    idx = 0;
    renderStats();
    renderZikir();
    toast('Semua data telah dipadam');
  });

  // ---------- Views ----------
  let currentView = 'zikir';
  function showView(v) {
    currentView = v;
    $$('.view').forEach((el) => el.classList.toggle('is-active', el.id === 'view-' + v));
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === v));
    if (v === 'list') renderList();
    if (v === 'stats') renderStats();
    updateWakeLock();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  // ---------- Events ----------
  // Header logo: refresh the page, checking for a newer app version first
  $('#logoBtn').addEventListener('click', async () => {
    $('#logoBtn').classList.add('is-loading');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await Promise.race([reg.update(), new Promise((r) => setTimeout(r, 1500))]);
    } catch { /* offline: just reload from cache */ }
    location.reload();
  });
  $('#tapBtn').addEventListener('click', tap);
  $('#prevBtn').addEventListener('click', () => go(idx - 1));
  $('#nextBtn').addEventListener('click', () => go(idx + 1));
  $('#resetBtn').addEventListener('click', resetCurrent);
  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#doneRestart').addEventListener('click', restartSession);
  $('#doneStats').addEventListener('click', () => { $('#doneOverlay').hidden = true; showView('stats'); });

  // Swipe between adhkar
  let sx = 0, sy = 0, swiping = false;
  const card = $('#card');
  card.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiping = true; }, { passive: true });
  card.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? idx + 1 : idx - 1);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (currentView !== 'zikir' || e.target.closest('input')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); }
    else if (e.key === 'ArrowRight') go(idx + 1);
    else if (e.key === 'ArrowLeft') go(idx - 1);
  });

  // Keep the screen awake while reading
  let wakeLock = null;
  async function updateWakeLock() {
    const want = currentView === 'zikir' && document.visibilityState === 'visible';
    try {
      if (want && !wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch { /* not permitted */ }
  }
  document.addEventListener('visibilitychange', () => {
    updateWakeLock();
    // New day while the app was in the background → fresh session
    if (document.visibilityState === 'visible') {
      const s = store.get('zk.sess.' + mode, null);
      if (s && s.day !== dayKey()) { loadSession(); $('#doneOverlay').hidden = true; renderZikir(); }
    }
  });

  // ---------- Install (PWA) ----------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('Aplikasi berjaya dipasang'); });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIOS && !standalone) $('#iosHint').hidden = false;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- Boot ----------
  applySettings();
  buildList();
  loadSession();
  renderZikir();
  if (allDone()) $('#doneOverlay').hidden = false;
  updateWakeLock();
})();
