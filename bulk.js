/* global TrelloPowerUp */
(function () {
  'use strict';

  var CFG = window.BULK_CONFIG || {};
  var t = TrelloPowerUp.iframe({ appKey: CFG.appKey, appName: CFG.appName });
  var api = t.getRestApi();

  // Barvy štítků podle aktuální palety Trella
  var COLORS = {
    green: '#4bce97', green_dark: '#1f845a', green_light: '#baf3db',
    yellow: '#f5cd47', yellow_dark: '#946f00', yellow_light: '#f8e6a0',
    orange: '#fea362', orange_dark: '#c25100', orange_light: '#fedec8',
    red: '#f87168', red_dark: '#c9372c', red_light: '#ffd5d2',
    purple: '#9f8fef', purple_dark: '#6e5dc6', purple_light: '#dfd8fd',
    blue: '#579dff', blue_dark: '#0c66e4', blue_light: '#cce0ff',
    sky: '#6cc3e0', sky_dark: '#227d9b', sky_light: '#c6edfb',
    lime: '#94c748', lime_dark: '#5b7f24', lime_light: '#d3f1a7',
    pink: '#e774bb', pink_dark: '#ae4787', pink_light: '#fdd0ec',
    black: '#8590a2', black_dark: '#626f86', black_light: '#dcdfe4'
  };
  var COLOR_NAMES = {
    green: 'zelený', yellow: 'žlutý', orange: 'oranžový', red: 'červený', purple: 'fialový',
    blue: 'modrý', sky: 'blankytný', lime: 'limetkový', pink: 'růžový', black: 'šedý'
  };

  var state = {
    lists: [],
    labels: [],
    labelById: new Map(),
    cardById: new Map(),
    selected: new Set(),
    ops: new Map(),          // idLabel -> 'add' | 'remove'
    query: '',
    labelFilter: '',
    lastId: null,
    busy: false,
    pendingReload: false
  };

  var els = {
    board: document.getElementById('board'),
    search: document.getElementById('search'),
    filter: document.getElementById('label-filter'),
    selectVisible: document.getElementById('select-visible'),
    clear: document.getElementById('clear-selection'),
    count: document.getElementById('selected-count'),
    chips: document.getElementById('chips'),
    apply: document.getElementById('apply'),
    resetOps: document.getElementById('reset-ops'),
    status: document.getElementById('status'),
    auth: document.getElementById('auth'),
    authButton: document.getElementById('auth-button')
  };

  /* ---------- Pomocné funkce ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function plural(n) {
    if (n === 1) return 'karta';
    if (n >= 2 && n <= 4) return 'karty';
    return 'karet';
  }
  function cardsText(n) { return n + ' ' + plural(n); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function labelColor(color) { return COLORS[color] || null; }
  function labelTextColor(color) {
    return color && /_dark$/.test(color) ? '#ffffff' : '#172b4d';
  }
  function labelTitle(label) {
    if (label.name) return label.name;
    var base = label.color ? label.color.split('_')[0] : null;
    return base ? (COLOR_NAMES[base] || base) + ' (bez názvu)' : 'bez barvy a názvu';
  }

  function setStatus(text, kind) {
    els.status.textContent = text || '';
    els.status.className = 'status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- Filtrování ---------- */

  function isVisible(card) {
    if (state.query && norm(card.name).indexOf(state.query) === -1) return false;
    if (state.labelFilter === '__none') return card.labels.length === 0;
    if (state.labelFilter) return card.labels.indexOf(state.labelFilter) !== -1;
    return true;
  }
  function visibleCards(list) { return list.cards.filter(isVisible); }
  function allVisibleIds() {
    var ids = [];
    state.lists.forEach(function (l) { visibleCards(l).forEach(function (c) { ids.push(c.id); }); });
    return ids;
  }

  /* ---------- Načtení dat ---------- */

  function load() {
    if (state.busy) { state.pendingReload = true; return Promise.resolve(); }
    return Promise.all([t.lists('all'), t.board('id', 'labels')])
      .then(function (res) {
        var lists = res[0] || [];
        var board = res[1] || {};
        state.labels = board.labels || [];
        state.labelById = new Map(state.labels.map(function (l) { return [l.id, l]; }));
        state.cardById = new Map();
        state.lists = lists.map(function (l) {
          return {
            id: l.id,
            name: l.name,
            cards: (l.cards || []).map(function (c) {
              var card = {
                id: c.id,
                name: c.name,
                labels: (c.labels || []).map(function (x) { return x.id; })
              };
              state.cardById.set(card.id, card);
              return card;
            })
          };
        });
        Array.from(state.selected).forEach(function (id) {
          if (!state.cardById.has(id)) state.selected.delete(id);
        });
        Array.from(state.ops.keys()).forEach(function (id) {
          if (!state.labelById.has(id)) state.ops.delete(id);
        });
        renderFilter();
        renderBoard();
        sync();
      })
      .catch(function (err) {
        setStatus('Karty se nepodařilo načíst: ' + (err && err.message ? err.message : err), 'error');
      });
  }

  /* ---------- Vykreslení ---------- */

  function renderFilter() {
    var current = state.labelFilter;
    var html = '<option value="">Všechny štítky</option><option value="__none">Karty bez štítku</option>';
    state.labels.forEach(function (l) {
      html += '<option value="' + esc(l.id) + '">' + esc(labelTitle(l)) + '</option>';
    });
    els.filter.innerHTML = html;
    if (current && current !== '__none' && !state.labelById.has(current)) current = '';
    state.labelFilter = current;
    els.filter.value = current;
  }

  function pillHtml(label) {
    var bg = labelColor(label.color);
    var style = bg
      ? 'background:' + bg + ';color:' + labelTextColor(label.color)
      : 'border:1px dashed currentColor';
    return '<span class="pill" style="' + style + '" title="' + esc(labelTitle(label)) + '">' +
      esc(label.name || '') + '</span>';
  }

  function cardHtml(card) {
    var pills = card.labels
      .map(function (id) { return state.labelById.get(id); })
      .filter(Boolean)
      .map(pillHtml)
      .join('');
    return '<label class="card" data-card="' + esc(card.id) + '">' +
      '<input type="checkbox" class="card-check" data-card="' + esc(card.id) + '">' +
      '<span class="card-body">' +
        (pills ? '<span class="pills">' + pills + '</span>' : '') +
        '<span class="card-name">' + esc(card.name) + '</span>' +
      '</span></label>';
  }

  function renderBoard() {
    // Zachovat pozice scrollu při překreslení
    var left = els.board.scrollLeft;
    var tops = {};
    els.board.querySelectorAll('.column').forEach(function (col) {
      tops[col.dataset.list] = col.querySelector('.cards').scrollTop;
    });

    if (!state.lists.length) {
      els.board.innerHTML = '<p class="empty">Na boardu nejsou žádné sloupce.</p>';
      return;
    }

    els.board.innerHTML = state.lists.map(function (list) {
      var cards = visibleCards(list);
      var body = cards.length
        ? cards.map(cardHtml).join('')
        : '<p class="empty">' + (list.cards.length ? 'Filtru neodpovídá žádná karta' : 'Sloupec je prázdný') + '</p>';
      return '<section class="column" data-list="' + esc(list.id) + '">' +
        '<label class="column-head">' +
          '<input type="checkbox" class="list-check" data-list="' + esc(list.id) + '"' +
            (cards.length ? '' : ' disabled') + ' aria-label="Vybrat všechny karty ve sloupci ' + esc(list.name) + '">' +
          '<span class="column-name">' + esc(list.name) + '</span>' +
          '<span class="column-count" data-count="' + esc(list.id) + '"></span>' +
        '</label>' +
        '<div class="cards">' + body + '</div>' +
      '</section>';
    }).join('');

    els.board.scrollLeft = left;
    els.board.querySelectorAll('.column').forEach(function (col) {
      if (tops[col.dataset.list] != null) col.querySelector('.cards').scrollTop = tops[col.dataset.list];
    });
  }

  // Aktualizace stavu výběru bez překreslení boardu
  function sync() {
    els.board.querySelectorAll('.card').forEach(function (el) {
      var on = state.selected.has(el.dataset.card);
      el.classList.toggle('is-selected', on);
      el.querySelector('input').checked = on;
    });
    state.lists.forEach(function (list) {
      var vis = visibleCards(list);
      var n = vis.filter(function (c) { return state.selected.has(c.id); }).length;
      var box = els.board.querySelector('.list-check[data-list="' + list.id + '"]');
      var cnt = els.board.querySelector('[data-count="' + list.id + '"]');
      if (box) {
        box.checked = vis.length > 0 && n === vis.length;
        box.indeterminate = n > 0 && n < vis.length;
      }
      if (cnt) cnt.textContent = n ? n + '/' + vis.length : String(vis.length);
    });
    renderDock();
  }

  function buildJobs() {
    var jobs = [];
    state.selected.forEach(function (id) {
      var card = state.cardById.get(id);
      if (!card) return;
      var add = [], remove = [];
      state.ops.forEach(function (op, labelId) {
        var has = card.labels.indexOf(labelId) !== -1;
        if (op === 'add' && !has) add.push(labelId);
        if (op === 'remove' && has) remove.push(labelId);
      });
      if (add.length || remove.length) jobs.push({ card: card, add: add, remove: remove });
    });
    return jobs;
  }

  function renderDock() {
    var n = state.selected.size;
    els.count.textContent = n ? 'Vybráno: ' + cardsText(n) : 'Vyberte karty, které chcete upravit';

    var selectedCards = [];
    state.selected.forEach(function (id) {
      var c = state.cardById.get(id);
      if (c) selectedCards.push(c);
    });

    if (!state.labels.length) {
      els.chips.innerHTML = '<p class="empty">Board nemá žádné štítky. Vytvořte je v Trellu v nabídce boardu.</p>';
    } else {
      els.chips.innerHTML = state.labels.map(function (l) {
        var op = state.ops.get(l.id) || '';
        var has = selectedCards.filter(function (c) { return c.labels.indexOf(l.id) !== -1; }).length;
        var bg = labelColor(l.color);
        var action = op === 'add' ? 'přidat' : op === 'remove' ? 'odebrat' : 'beze změny';
        return '<button type="button" class="chip' + (op ? ' is-' + op : '') + '" data-label="' + esc(l.id) + '"' +
          ' aria-label="Štítek ' + esc(labelTitle(l)) + ': ' + action + '">' +
          '<span class="chip-mark" aria-hidden="true">' + (op === 'add' ? '+' : op === 'remove' ? '−' : '') + '</span>' +
          '<span class="swatch' + (bg ? '' : ' is-none') + '"' + (bg ? ' style="background:' + bg + '"' : '') + '></span>' +
          '<span class="chip-name">' + esc(labelTitle(l)) + '</span>' +
          (n ? '<span class="chip-count" title="Počet vybraných karet s tímto štítkem">' + has + '/' + n + '</span>' : '') +
        '</button>';
      }).join('');
    }

    var changes = buildJobs().length;
    els.apply.disabled = state.busy || !changes;
    els.apply.textContent = changes ? 'Upravit štítky (' + cardsText(changes) + ')' : 'Upravit štítky';
    els.resetOps.hidden = !state.ops.size || state.busy;
    els.selectVisible.disabled = state.busy;
    els.clear.disabled = state.busy;
  }

  /* ---------- Autorizace ---------- */

  function showAuth(show) { els.auth.hidden = !show; }

  els.authButton.addEventListener('click', function () {
    api.authorize({ scope: 'read,write', expiration: 'never' })
      .then(function () {
        showAuth(false);
        setStatus('Přístup povolen.', 'ok');
      })
      .catch(function () {
        setStatus('Přístup nebyl povolen. Bez něj nejde štítky měnit.', 'error');
      });
  });

  /* ---------- Volání Trello REST API ---------- */

  // Trello povoluje 100 požadavků za 10 s na token → držíme se pod ~8 za sekundu
  var nextSlot = 0;
  function throttle() {
    var now = Date.now();
    var wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + 125;
    return wait ? sleep(wait) : Promise.resolve();
  }

  function request(method, path, params, token) {
    var query = new URLSearchParams(params || {});
    query.set('key', CFG.appKey);
    query.set('token', token);
    var url = 'https://api.trello.com/1' + path + '?' + query.toString();

    function attempt(n) {
      return throttle()
        .then(function () { return fetch(url, { method: method }); })
        .then(function (res) {
          if (res.ok) return;
          if (res.status === 429 && n < 5) {
            return sleep(1500 * (n + 1)).then(function () { return attempt(n + 1); });
          }
          return res.text().catch(function () { return ''; }).then(function (text) {
            var err = new Error((res.status + ' ' + text).trim());
            err.status = res.status;
            throw err;
          });
        });
    }
    return attempt(0);
  }

  function runPool(items, size, worker) {
    var i = 0;
    function next() {
      if (i >= items.length) return Promise.resolve();
      var item = items[i++];
      return worker(item).then(next);
    }
    var runners = [];
    for (var k = 0; k < Math.min(size, items.length); k++) runners.push(next());
    return Promise.all(runners);
  }

  function processJob(job, token) {
    var chain = Promise.resolve();
    job.add.forEach(function (labelId) {
      chain = chain.then(function () {
        return request('POST', '/cards/' + job.card.id + '/idLabels', { value: labelId }, token);
      }).then(function () {
        if (job.card.labels.indexOf(labelId) === -1) job.card.labels.push(labelId);
      });
    });
    job.remove.forEach(function (labelId) {
      chain = chain.then(function () {
        return request('DELETE', '/cards/' + job.card.id + '/idLabels/' + labelId, null, token);
      }).then(function () {
        job.card.labels = job.card.labels.filter(function (x) { return x !== labelId; });
      });
    });
    return chain;
  }

  function apply() {
    var jobs = buildJobs();
    if (!jobs.length) return;

    api.isAuthorized().then(function (ok) {
      if (!ok) {
        showAuth(true);
        setStatus('Nejdřív povolte přístup k Trellu.', 'error');
        return;
      }
      return api.getToken().then(function (token) {
        state.busy = true;
        var done = 0;
        var failed = [];
        var authError = false;
        renderDock();
        setStatus('Ukládám… 0 / ' + jobs.length);

        return runPool(jobs, 3, function (job) {
          return processJob(job, token)
            .catch(function (err) {
              if (err.status === 401) authError = true;
              failed.push({ card: job.card, error: err });
            })
            .then(function () {
              done++;
              setStatus('Ukládám… ' + done + ' / ' + jobs.length);
            });
        }).then(function () {
          state.busy = false;
          state.ops.clear();
          renderBoard();
          sync();

          var okCount = jobs.length - failed.length;
          if (!failed.length) {
            setStatus('Štítky upraveny: ' + cardsText(okCount) + '.', 'ok');
          } else if (authError) {
            showAuth(true);
            setStatus('Platnost přístupu vypršela. Povolte přístup znovu a úpravu zopakujte.', 'error');
          } else {
            var names = failed.slice(0, 3).map(function (f) { return '„' + f.card.name + '“'; }).join(', ');
            setStatus('Upraveno ' + okCount + ' z ' + jobs.length + '. Nepodařilo se: ' + names +
              (failed.length > 3 ? ' a další' : '') + '. Zkuste to znovu.', 'error');
            console.error('Chyby při úpravě karet:', failed);
          }

          if (state.pendingReload) {
            state.pendingReload = false;
            load();
          }
        });
      });
    }).catch(function (err) {
      state.busy = false;
      renderDock();
      setStatus('Úprava selhala: ' + (err && err.message ? err.message : err), 'error');
    });
  }

  /* ---------- Události ---------- */

  // Shift při kliknutí myší (pro výběr rozsahu)
  var pointerShift = false;
  document.addEventListener('pointerdown', function (e) { pointerShift = e.shiftKey; }, true);

  els.board.addEventListener('change', function (e) {
    var el = e.target;
    if (state.busy) { sync(); return; }

    if (el.classList.contains('card-check')) {
      var id = el.dataset.card;
      var on = el.checked;
      var ids = pointerShift && state.lastId && state.lastId !== id ? allVisibleIds() : null;
      var a = ids ? ids.indexOf(state.lastId) : -1;
      var b = ids ? ids.indexOf(id) : -1;
      if (a > -1 && b > -1) {
        ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (x) {
          if (on) state.selected.add(x); else state.selected.delete(x);
        });
      } else if (on) {
        state.selected.add(id);
      } else {
        state.selected.delete(id);
      }
      state.lastId = id;
      pointerShift = false;
      sync();
    } else if (el.classList.contains('list-check')) {
      var list = state.lists.find(function (l) { return l.id === el.dataset.list; });
      if (!list) return;
      var vis = visibleCards(list);
      var allOn = vis.every(function (c) { return state.selected.has(c.id); });
      vis.forEach(function (c) {
        if (allOn) state.selected.delete(c.id); else state.selected.add(c.id);
      });
      pointerShift = false;
      sync();
    }
  });

  els.chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip || state.busy) return;
    var id = chip.dataset.label;
    var op = state.ops.get(id);
    if (!op) state.ops.set(id, 'add');
    else if (op === 'add') state.ops.set(id, 'remove');
    else state.ops.delete(id);
    setStatus('');
    renderDock();
    var again = els.chips.querySelector('.chip[data-label="' + id + '"]');
    if (again) again.focus();
  });

  var searchTimer = null;
  els.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = norm(els.search.value.trim());
      renderBoard();
      sync();
    }, 120);
  });

  els.filter.addEventListener('change', function () {
    state.labelFilter = els.filter.value;
    renderBoard();
    sync();
  });

  els.selectVisible.addEventListener('click', function () {
    allVisibleIds().forEach(function (id) { state.selected.add(id); });
    sync();
  });

  els.clear.addEventListener('click', function () {
    state.selected.clear();
    state.lastId = null;
    sync();
  });

  els.resetOps.addEventListener('click', function () {
    state.ops.clear();
    renderDock();
  });

  els.apply.addEventListener('click', apply);

  /* ---------- Start ---------- */

  if (!CFG.appKey || CFG.appKey === 'VLOZTE_SVUJ_API_KLIC') {
    setStatus('V souboru config.js chybí API klíč. Bez něj nejde štítky měnit.', 'error');
  } else {
    api.isAuthorized().then(function (ok) { showAuth(!ok); }).catch(function () { showAuth(true); });
  }

  // Trello volá render při otevření i při každé změně na boardu
  t.render(function () { return load(); });
})();
