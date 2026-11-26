/* Side-Bear – Frontend-Modul
 * Gruppiert die Seitenleiste von Home Assistant, klappt Gruppen pro Gerät auf
 * und zu, blendet Einträge (auch abhängig von Entitäten) aus und hält die
 * Startseite immer ganz oben.
 *
 * Wie es arbeitet (nur offizielle Wege von HA):
 *  - Einstellungen: Websocket side_bear/config, side_bear/save, side_bear/subscribe
 *  - Seitenleiste pro Gerät: HA liest Reihenfolge und ausgeblendete Einträge aus
 *    den Benutzerdaten "sidebar"; fehlen dort panelOrder/hiddenPanels, nimmt HA den
 *    Gerätespeicher (localStorage sidebarPanelOrder/sidebarHiddenPanels). Side-Bear
 *    schreibt den Soll-Zustand in den Gerätespeicher und in die Benutzerdaten nur
 *    einen Zähler, damit alle Geräte neu lesen.
 *  - Gruppen-Überschriften sind Panels der Integration (side-bear-g-<id>[-zu]).
 *    Ein Klick darauf klappt um; greift das Abfangen nicht (z. B. Handy-App),
 *    öffnet HA die Gruppenseite, Side-Bear klappt dann um und springt zurück.
 */
(function () {
  if (window.__sideBear) return;
  var SB = (window.__sideBear = { version: '1.0.0' });

  var HEADER = 'side-bear-g-';
  var CLOSED = '-zu';
  var SETTINGS = 'side-bear';
  var EXCLUDE = ['config', 'profile', 'notfound', '_my_redirect', 'app', 'developer-tools'];
  var ICONS = {
    energy: 'mdi:lightning-bolt', logbook: 'mdi:format-list-bulleted-type', history: 'mdi:chart-box',
    calendar: 'mdi:calendar', todo: 'mdi:clipboard-list', 'media-browser': 'mdi:play-box-multiple',
    maintenance: 'mdi:wrench', lovelace: 'mdi:view-dashboard', map: 'mdi:tooltip-account'
  };
  var data = null;
  var userSidebar;
  var ui = { collapsed: {} };
  var lastWritten = null;
  var listeners = [];

  function hass() {
    var h = document.querySelector('home-assistant');
    return h ? h.hass : null;
  }
  function ws(msg) { return hass().connection.sendMessagePromise(msg); }
  SB.onChange = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ---------- Einstellungen ---------- */
  SB.getData = function () { return data; };
  SB.load = async function () {
    if (!hass()) return null;
    try { data = await ws({ type: 'side_bear/config' }); } catch (e) { data = null; }
    emit();
    return data;
  };
  SB.save = async function (newData) {
    data = await ws({ type: 'side_bear/save', config: newData });
    lastWritten = null;
    await SB.apply();
    emit();
  };

  function slug(id) { return String(id).toLowerCase().replace(/[^a-z0-9]/g, '') || 'gruppe'; }
  SB.groupUrl = function (g, closed) { return HEADER + slug(g.id) + (closed ? CLOSED : ''); };
  SB.groupByUrl = function (url) {
    if (!data) return null;
    return data.groups.filter(function (x) { return SB.groupUrl(x) === url || SB.groupUrl(x, true) === url; })[0] || null;
  };

  SB.panels = function () {
    var h = hass();
    if (!h) return [];
    return Object.keys(h.panels).map(function (k) { return h.panels[k]; }).filter(function (p) {
      return p.title && EXCLUDE.indexOf(p.url_path) < 0 && p.show_in_sidebar !== false && p.url_path.indexOf(HEADER) !== 0;
    }).map(function (p) {
      var name = h.localize('panel.' + p.title) || p.title;
      return { id: p.url_path, name: name, icon: p.icon || ICONS[p.url_path] || 'mdi:view-dashboard', admin: !!p.require_admin };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  };

  SB.condOk = function (cond) {
    if (!cond || !cond.entity) return true;
    var h = hass();
    var s = h && h.states[cond.entity];
    var v = s ? s.state : 'unavailable';
    var want = String(cond.state == null ? 'on' : cond.state);
    return cond.op === '!=' ? v !== want : v === want;
  };

  SB.isCollapsed = function (g) {
    var c = ui && ui.collapsed ? ui.collapsed[g.id] : undefined;
    return c === undefined ? !g.startOpen : !!c;
  };

  SB.home = function (d) { d = d || data; return (d && d.home) || 'lovelace'; };

  // {panelOrder, hiddenPanels, reasons}; zugeklappte Einträge haben keinen "reason"
  SB.compute = function (d) {
    d = d || data;
    var home = SB.home(d);
    var order = [home];
    var groupOf = {};
    var reasons = {};
    var hidden = [];
    (d.groups || []).forEach(function (g) {
      var open = SB.groupUrl(g), zu = SB.groupUrl(g, true);
      order.push(open, zu);
      if (g.hidden || !SB.condOk(g.cond)) hidden.push(open, zu);
      else hidden.push(SB.isCollapsed(g) ? open : zu);
      (g.panels || []).forEach(function (p) {
        if (groupOf[p] || p === home) return;
        groupOf[p] = g;
        order.push(p);
      });
    });
    var ids = {};
    SB.panels().forEach(function (p) { ids[p.id] = 1; });
    Object.keys(d.items || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(groupOf).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (id) {
      var it = (d.items || {})[id] || {};
      var g = groupOf[id];
      var why = null;
      if (it.hidden) why = 'ausgeblendet';
      else if (g && g.hidden) why = 'Gruppe ausgeblendet';
      else if (!SB.condOk(it.cond)) why = 'Bedingung nicht erfüllt';
      else if (g && !SB.condOk(g.cond)) why = 'Gruppen-Bedingung nicht erfüllt';
      if (why) { hidden.push(id); reasons[id] = why; }
      else if (g && SB.isCollapsed(g)) hidden.push(id);
    });
    hidden.sort();
    return { panelOrder: order, hiddenPanels: hidden, reasons: reasons };
  };

  function norm(v) {
    if (!v) return null;
    return JSON.stringify({ panelOrder: v.panelOrder || [], hiddenPanels: (v.hiddenPanels || []).slice().sort() });
  }

  // Soll-Zustand. Inaktiv = HA-Standard, nur die Gruppen-Überschriften bleiben ausgeblendet.
  SB.target = function () {
    if (data.enabled) {
      var c = SB.compute();
      return { panelOrder: c.panelOrder, hiddenPanels: c.hiddenPanels };
    }
    var hidden = [];
    var h = hass();
    if (h) Object.keys(h.panels).forEach(function (k) { if (k.indexOf(HEADER) === 0) hidden.push(k); });
    hidden.sort();
    return { panelOrder: [], hiddenPanels: hidden };
  };

  function readLocal() {
    try {
      return {
        panelOrder: JSON.parse(localStorage.getItem('sidebarPanelOrder') || '[]'),
        hiddenPanels: JSON.parse(localStorage.getItem('sidebarHiddenPanels') || '[]')
      };
    } catch (e) { return null; }
  }
  function userDataClean() {
    return !(userSidebar && (userSidebar.panelOrder || userSidebar.hiddenPanels));
  }

  SB.status = function () {
    if (!hass()) return 'warte auf Home Assistant';
    if (!data) return 'Side-Bear ist nicht geladen';
    var ok = userDataClean() && norm(readLocal()) === norm(SB.target());
    if (!data.enabled) return ok ? 'inaktiv – normale HA-Seitenleiste' : 'inaktiv – normale Seitenleiste wird hergestellt …';
    return ok ? 'aktiv – Seitenleiste ist synchron' : 'aktiv – wird abgeglichen …';
  };

  SB.apply = async function () {
    if (!hass() || !data || userSidebar === undefined) return;
    var want = SB.target();
    var key = norm(want);
    if (userDataClean() && key === norm(readLocal())) return;
    if (key === lastWritten) return;
    lastWritten = key;
    try {
      localStorage.setItem('sidebarPanelOrder', JSON.stringify(want.panelOrder));
      localStorage.setItem('sidebarHiddenPanels', JSON.stringify(want.hiddenPanels));
      if (norm(readLocal()) !== key) throw new Error('Gerätespeicher nicht beschreibbar');
      await ws({ type: 'frontend/set_user_data', key: 'sidebar', value: { sideBearRev: Date.now().toString(36) + Math.floor(Math.random() * 1000) } });
    } catch (e) {
      console.warn('Side-Bear: Seitenleiste konnte nicht gesetzt werden', e);
    }
  };

  /* ---------- Auf-/Zuklappen (pro Gerät) ---------- */
  try { ui = JSON.parse(localStorage.getItem('sideBearUi') || 'null') || { collapsed: {} }; } catch (e) { ui = { collapsed: {} }; }
  function setUi(next) {
    ui = next;
    try { localStorage.setItem('sideBearUi', JSON.stringify(next)); } catch (e) {}
    lastWritten = null;
    emit();
    return SB.apply();
  }
  SB.toggle = function (gid) {
    if (!data) return;
    var g = data.groups.filter(function (x) { return x.id === gid; })[0];
    if (!g) return;
    var next = { collapsed: Object.assign({}, ui.collapsed || {}) };
    next.collapsed[gid] = !SB.isCollapsed(g);
    return setUi(next);
  };
  SB.setAll = function (collapsed) {
    if (!data) return;
    var next = { collapsed: {} };
    data.groups.forEach(function (g) { next.collapsed[g.id] = collapsed; });
    return setUi(next);
  };
  SB.resetUi = function () { return setUi({ collapsed: {} }); };

  // Klick auf eine Überschrift in der Seitenleiste: umschalten statt öffnen
  window.addEventListener('click', function (e) {
    if (!data || !data.enabled || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var path = e.composedPath ? e.composedPath() : [];
    var inSidebar = false, url = null;
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!el || !el.tagName) continue;
      if (el.tagName === 'HA-SIDEBAR') inSidebar = true;
      if (!url && el.getAttribute) {
        var href = el.getAttribute('href') || (el.dataset ? el.dataset.panel : null);
        if (href) url = href.replace(/^\//, '').split('/')[0];
      }
    }
    if (!inSidebar || !url || url.indexOf(HEADER) !== 0) return;
    var g = SB.groupByUrl(url);
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    SB.toggle(g.id);
  }, true);

  // Ersatzweg: über die Seitenleiste auf einer Überschrift gelandet → umschalten und zurück.
  // Direkt aufgerufen (ohne vorherige Seite oder mit ?ansehen) bleibt die Gruppenseite stehen.
  var lastPath = null, handling = false;
  function openMenu() {
    try {
      var ha = document.querySelector('home-assistant');
      var main = ha && ha.shadowRoot && ha.shadowRoot.querySelector('home-assistant-main');
      if (main) main.dispatchEvent(new CustomEvent('hass-toggle-menu', { detail: { open: true }, bubbles: true, composed: true }));
    } catch (e) {}
  }
  function checkPath() {
    var p = location.pathname;
    var seg = p.replace(/^\//, '').split('/')[0];
    if (seg.indexOf(HEADER) === 0) {
      if (handling || !lastPath || !data || !data.enabled || /[?&]ansehen/.test(location.search)) return;
      var g = SB.groupByUrl(seg);
      if (!g) return;
      handling = true;
      SB.toggle(g.id);
      history.replaceState(null, '', lastPath);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
      setTimeout(openMenu, 300);
      setTimeout(function () { handling = false; }, 800);
      return;
    }
    lastPath = p + location.search;
  }
  setInterval(checkPath, 250);
  window.addEventListener('location-changed', function () { setTimeout(checkPath, 0); });
  window.addEventListener('popstate', function () { setTimeout(checkPath, 0); });

  SB.navigate = function (path) {
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  };

  /* ---------- Start ---------- */
  async function start() {
    var h = hass();
    if (!h || !h.connection || !h.panels) { setTimeout(start, 1000); return; }
    await SB.load();
    try {
      h.connection.subscribeMessage(function (m) {
        userSidebar = m && m.value ? m.value : null;
        lastWritten = null;
        emit();
        SB.load().then(SB.apply);
      }, { type: 'frontend/subscribe_user_data', key: 'sidebar' });
      h.connection.subscribeMessage(function (m) {
        data = m ? m.config : null;
        lastWritten = null;
        emit();
        SB.apply();
      }, { type: 'side_bear/subscribe' });
    } catch (e) {
      console.warn('Side-Bear: Abo fehlgeschlagen', e);
    }
    setInterval(function () { SB.apply(); }, 3000);
    setInterval(function () { SB.load().then(SB.apply); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) SB.load().then(SB.apply);
    });
  }
  start();

  /* ---------- Oberfläche ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  var STYLE =
    ':host{display:block}' +
    '*{box-sizing:border-box}' +
    'ha-card{padding:16px}' +
    '.top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:8px}' +
    '.top h2{margin:0;font-size:20px;font-weight:500;flex:1 1 auto}' +
    '.bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}' +
    '.status{font-size:13px;color:var(--secondary-text-color);margin-bottom:12px}' +
    '.status.err{color:var(--error-color)}' +
    'button{font:inherit;font-size:14px;cursor:pointer;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);border-radius:8px;padding:6px 10px;display:inline-flex;align-items:center;gap:4px;min-height:36px}' +
    'button.icon{border:none;background:none;padding:6px;color:var(--secondary-text-color);border-radius:50%;min-width:36px;justify-content:center}' +
    'button.icon:hover{background:var(--secondary-background-color)}' +
    'button.primary{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:var(--primary-color)}' +
    'button[disabled]{opacity:.35;cursor:default}' +
    '.group{border:1px solid var(--divider-color);border-radius:12px;margin:12px 0;overflow:hidden}' +
    '.ghead{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding:8px 10px;background:var(--secondary-background-color)}' +
    '.gmain{display:flex;align-items:center;gap:6px;flex:1 1 220px;min-width:0}' +
    '.gmain input.gname{flex:1;min-width:0;font:inherit;font-weight:500;background:none;border:none;color:var(--primary-text-color);padding:4px}' +
    '.gmain input.gname:focus{outline:1px solid var(--primary-color);border-radius:4px}' +
    '.gstate{font-size:12px;padding:2px 8px;border-radius:10px;white-space:nowrap;cursor:pointer}' +
    '.gstate.auf{background:var(--success-color,#43a047);color:#fff}' +
    '.gstate.zu{background:var(--divider-color);color:var(--primary-text-color)}' +
    '.ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:4px}' +
    '.gcount{font-size:12px;color:var(--secondary-text-color);padding:0 4px}' +
    '.row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding:6px 10px;border-top:1px solid var(--divider-color)}' +
    '.row:first-of-type{border-top:none}' +
    '.rmain{display:flex;align-items:center;gap:8px;flex:1 1 200px;min-width:0}' +
    '.row.off .name,.row.off ha-icon.pi{opacity:.4}' +
    '.name{flex:1;min-width:0;cursor:pointer;overflow-wrap:anywhere}' +
    '.name b{font-weight:400}' +
    '.why{display:block;font-size:12px;color:var(--warning-color,#e69500)}' +
    '.adm{font-size:11px;color:var(--secondary-text-color)}' +
    'select,input.txt{font:inherit;font-size:14px;padding:6px;border-radius:6px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);min-height:36px}' +
    'select{max-width:170px}' +
    '.cond{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px 10px 40px;font-size:13px}' +
    '.cond input.ent{min-width:0;flex:1 1 220px}' +
    '.cond input.st{width:110px}' +
    '.empty{padding:10px;color:var(--secondary-text-color);font-size:13px}' +
    'textarea{width:100%;min-height:160px;font-family:monospace;font-size:12px}' +
    '.switch{display:flex;align-items:center;gap:6px;cursor:pointer}' +
    'ha-icon{--mdc-icon-size:22px}' +
    '.hint{font-size:12px;color:var(--secondary-text-color);margin-top:12px;line-height:1.5}' +
    '@media (max-width:600px){' +
    'ha-card{padding:10px}' +
    '.top h2{font-size:18px}' +
    '.bar button{flex:1 1 calc(50% - 8px);justify-content:center}' +
    '.ghead,.row{padding:8px}' +
    '.gmain,.rmain{flex-basis:100%}' +
    '.ctrl{width:100%;justify-content:flex-end}' +
    '.ctrl select{flex:1 1 120px;max-width:none}' +
    '.ctrl input.txt{flex:1 1 120px;width:auto!important}' +
    '.cond{padding:8px}' +
    '.cond input.ent,.cond select,.cond input.st{flex:1 1 100%;width:100%}' +
    '}';

  var PANEL_STYLE =
    ':host{display:block;background:var(--primary-background-color);min-height:100vh}' +
    '.toolbar{display:flex;align-items:center;height:56px;padding:0 12px;gap:8px;background:var(--app-header-background-color,var(--primary-color));color:var(--app-header-text-color,#fff);font-size:20px;position:sticky;top:0;z-index:2}' +
    '.toolbar .t{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.content{max-width:1100px;margin:0 auto;padding:16px}' +
    '@media (max-width:600px){.content{padding:8px}}';

  function addToolbar(host, title) {
    host.attachShadow({ mode: 'open' });
    host.shadowRoot.innerHTML = '<style>' + PANEL_STYLE + '</style><div class="toolbar"><span class="m"></span><span class="t">' + esc(title) + '</span></div><div class="content"></div>';
    var menu = null;
    if (customElements.get('ha-menu-button')) {
      menu = document.createElement('ha-menu-button');
      host.shadowRoot.querySelector('.m').appendChild(menu);
    }
    return { menu: menu, content: host.shadowRoot.querySelector('.content'), title: host.shadowRoot.querySelector('.t') };
  }

  /* ---------- Einstellungen (Inhalt der Seite "Side-Bear") ---------- */
  class SideBearSettings extends HTMLElement {
    set hass(h) {
      this._hass = h;
      if (!this._init) {
        this._init = true;
        this.attachShadow({ mode: 'open' });
        this._open = {};
        var self = this;
        SB.onChange(function () { if (!self._dirty) self._sync(); });
        this.shadowRoot.addEventListener('click', function (e) { self._click(e); });
        this.shadowRoot.addEventListener('change', function (e) { self._change(e); });
        SB.load().then(function () { self._sync(); });
        setInterval(function () { self._refreshStatus(); }, 3000);
      }
    }
    _sync() {
      var d = SB.getData();
      this._d = d ? JSON.parse(JSON.stringify(d)) : null;
      this._render();
    }
    _refreshStatus() {
      var el = this.shadowRoot && this.shadowRoot.querySelector('.status');
      if (el && !this._msg && !this._dirty) el.textContent = 'Status: ' + SB.status();
    }
    _save() {
      var self = this;
      self._dirty = true;
      clearTimeout(self._t);
      self._render();
      self._t = setTimeout(function () {
        SB.save(self._d).then(function () {
          self._dirty = false;
          self._msg = null;
          self._sync();
        }).catch(function (e) {
          self._dirty = false;
          self._msg = 'Fehler beim Speichern: ' + (e.message || e.code || e);
          self._render();
        });
      }, 500);
    }
    _item(id) {
      var it = this._d.items[id];
      if (!it) it = this._d.items[id] = {};
      return it;
    }
    _groupOf(id) {
      var gs = this._d.groups;
      for (var i = 0; i < gs.length; i++) if ((gs[i].panels || []).indexOf(id) >= 0) return gs[i];
      return null;
    }
    _moveToGroup(id, gid) {
      this._d.groups.forEach(function (g) {
        g.panels = (g.panels || []).filter(function (p) { return p !== id; });
      });
      if (gid) {
        var g = this._d.groups.filter(function (x) { return x.id === gid; })[0];
        if (g) g.panels.push(id);
      }
    }
    _click(e) {
      var b = e.target.closest('[data-act]');
      if (!b || b.disabled || !this._d) return;
      var act = b.dataset.act, id = b.dataset.id, d = this._d;
      var gi = d.groups.findIndex(function (g) { return g.id === id; });
      if (act === 'nav') { SB.navigate('/' + id); return; }
      if (act === 'gtoggle') { SB.toggle(id); return; }
      if (act === 'allopen') { SB.setAll(false); return; }
      if (act === 'allclose') { SB.setAll(true); return; }
      if (act === 'uireset') { SB.resetUi(); return; }
      if (act === 'enabled') { d.enabled = !d.enabled; }
      else if (act === 'addgroup') { d.groups.push({ id: uid(), name: 'Neue Gruppe', icon: 'mdi:folder', hidden: false, startOpen: false, panels: [] }); }
      else if (act === 'gup' && gi > 0) { d.groups.splice(gi - 1, 0, d.groups.splice(gi, 1)[0]); }
      else if (act === 'gdown' && gi < d.groups.length - 1) { d.groups.splice(gi + 1, 0, d.groups.splice(gi, 1)[0]); }
      else if (act === 'ghide') { d.groups[gi].hidden = !d.groups[gi].hidden; }
      else if (act === 'gdel') {
        if (!confirm('Gruppe "' + d.groups[gi].name + '" löschen? Die Dashboards landen in "Ohne Gruppe".')) return;
        d.groups.splice(gi, 1);
      }
      else if (act === 'gcond') { this._open['g:' + id] = !this._open['g:' + id]; this._render(); return; }
      else if (act === 'hide') { var it = this._item(id); it.hidden = !it.hidden; }
      else if (act === 'cond') { this._open[id] = !this._open[id]; this._render(); return; }
      else if (act === 'up' || act === 'down') {
        var g = this._groupOf(id);
        if (!g) return;
        var i = g.panels.indexOf(id), j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= g.panels.length) return;
        g.panels.splice(i, 1);
        g.panels.splice(j, 0, id);
      }
      else if (act === 'conddel') { delete this._item(id).cond; }
      else if (act === 'gconddel') { delete d.groups[gi].cond; }
      else if (act === 'export') { this._showExport = !this._showExport; this._render(); return; }
      else if (act === 'import') {
        var ta = this.shadowRoot.querySelector('textarea');
        try {
          var nd = JSON.parse(ta.value);
          if (nd && nd.einstellungen) nd = nd.einstellungen;
          if (!nd || !Array.isArray(nd.groups)) throw new Error('kein gültiges Format');
          nd.items = nd.items || {};
          this._d = nd;
        } catch (err) { alert('Import fehlgeschlagen: ' + err.message); return; }
      }
      else return;
      this._save();
    }
    _change(e) {
      var t = e.target, id = t.dataset.id, d = this._d;
      if (!t.dataset.f || !d) return;
      var f = t.dataset.f;
      if (f === 'group') { this._moveToGroup(id, t.value); }
      else if (f === 'home') { d.home = t.value; this._moveToGroup(t.value, null); }
      else if (f === 'gdefault') {
        var gd = d.groups.filter(function (x) { return x.id === id; })[0];
        gd.startOpen = t.value === 'auf';
      }
      else if (f === 'gname' || f === 'gicon') {
        var g = d.groups.filter(function (x) { return x.id === id; })[0];
        if (f === 'gname') g.name = t.value || 'Gruppe'; else g.icon = t.value;
      }
      else if (f === 'cent' || f === 'cop' || f === 'cst') {
        var target = t.dataset.g ? d.groups.filter(function (x) { return x.id === id; })[0] : this._item(id);
        var c = target.cond || (target.cond = { entity: '', op: '=', state: 'on' });
        if (f === 'cent') c.entity = t.value.trim();
        if (f === 'cop') c.op = t.value;
        if (f === 'cst') c.state = t.value.trim();
        if (!c.entity) delete target.cond;
      }
      else return;
      this._save();
    }
    _condHtml(cond, id, isGroup) {
      cond = cond || { entity: '', op: '=', state: 'on' };
      var g = isGroup ? ' data-g="1"' : '';
      return '<div class="cond">nur zeigen, wenn ' +
        '<input class="txt ent" list="sb-ents" placeholder="Entität, z. B. binary_sensor.xyz" data-f="cent" data-id="' + esc(id) + '"' + g + ' value="' + esc(cond.entity) + '">' +
        '<select data-f="cop" data-id="' + esc(id) + '"' + g + '><option value="="' + (cond.op !== '!=' ? ' selected' : '') + '>ist</option><option value="!="' + (cond.op === '!=' ? ' selected' : '') + '>ist nicht</option></select>' +
        '<input class="txt st" placeholder="on" data-f="cst" data-id="' + esc(id) + '"' + g + ' value="' + esc(cond.state) + '">' +
        (cond.entity ? '<span>(aktuell: ' + esc(this._hass.states[cond.entity] ? this._hass.states[cond.entity].state : 'fehlt') + ')</span>' +
          '<button class="icon" title="Bedingung entfernen" data-act="' + (isGroup ? 'gconddel' : 'conddel') + '" data-id="' + esc(id) + '"><ha-icon icon="mdi:close"></ha-icon></button>' : '') +
        '</div>';
    }
    _ctrlCondHide(id, it) {
      return '<button class="icon" title="Bedingung" data-act="cond" data-id="' + esc(id) + '"><ha-icon icon="' + (it.cond ? 'mdi:filter-check' : 'mdi:filter-outline') + '"></ha-icon></button>' +
        '<button class="icon" title="' + (it.hidden ? 'einblenden' : 'ausblenden') + '" data-act="hide" data-id="' + esc(id) + '"><ha-icon icon="' + (it.hidden ? 'mdi:eye-off' : 'mdi:eye') + '"></ha-icon></button>';
    }
    _rowHtml(p, g, idx, len, res) {
      var it = this._d.items[p.id] || {};
      var opts = '<option value="">Ohne Gruppe</option>' + this._d.groups.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (g && g.id === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
      }).join('');
      var why = res.reasons[p.id];
      var html = '<div class="row' + (why ? ' off' : '') + '"><div class="rmain">' +
        '<ha-icon class="pi" icon="' + esc(p.icon) + '"></ha-icon>' +
        '<div class="name" data-act="nav" data-id="' + esc(p.id) + '" title="Öffnen: /' + esc(p.id) + '"><b>' + esc(p.name) + '</b>' +
        (p.admin ? ' <span class="adm">(nur Admin)</span>' : '') +
        (why ? '<span class="why">' + esc(why) + '</span>' : '') + '</div></div><div class="ctrl">' +
        '<select data-f="group" data-id="' + esc(p.id) + '" title="Gruppe">' + opts + '</select>' +
        (g ? '<button class="icon" title="nach oben" data-act="up" data-id="' + esc(p.id) + '"' + (idx === 0 ? ' disabled' : '') + '><ha-icon icon="mdi:chevron-up"></ha-icon></button>' +
          '<button class="icon" title="nach unten" data-act="down" data-id="' + esc(p.id) + '"' + (idx === len - 1 ? ' disabled' : '') + '><ha-icon icon="mdi:chevron-down"></ha-icon></button>' : '') +
        this._ctrlCondHide(p.id, it) + '</div></div>';
      if (this._open[p.id]) html += this._condHtml(it.cond, p.id, false);
      return html;
    }
    _render() {
      if (!this.shadowRoot) return;
      var self = this, d = this._d;
      if (!d) {
        this.shadowRoot.innerHTML = '<style>' + STYLE + '</style><ha-card><div class="status err">Side-Bear ist nicht geladen. Ist die Integration eingerichtet?</div></ha-card>';
        return;
      }
      var panels = SB.panels();
      var byId = {};
      panels.forEach(function (p) { byId[p.id] = p; });
      var res = SB.compute(d);
      var used = {};
      var html = '<style>' + STYLE + '</style><ha-card>' +
        '<div class="top"><h2>Side-Bear</h2>' +
        '<label class="switch" data-act="enabled"><ha-icon icon="' + (d.enabled ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline') + '" style="color:' + (d.enabled ? 'var(--primary-color)' : 'var(--secondary-text-color)') + ';--mdc-icon-size:36px"></ha-icon>' + (d.enabled ? 'aktiv' : 'inaktiv') + '</label>' +
        '</div><div class="bar">' +
        '<button data-act="allopen" title="alle Gruppen auf diesem Gerät aufklappen"><ha-icon icon="mdi:unfold-more-horizontal"></ha-icon> Alle aufklappen</button>' +
        '<button data-act="allclose" title="alle Gruppen auf diesem Gerät zuklappen"><ha-icon icon="mdi:unfold-less-horizontal"></ha-icon> Alle zuklappen</button>' +
        '<button data-act="uireset" title="Auf/Zu auf diesem Gerät verwerfen, es gilt wieder der Standard jeder Gruppe"><ha-icon icon="mdi:restore"></ha-icon> Auf Standard</button>' +
        '<button data-act="addgroup"><ha-icon icon="mdi:folder-plus"></ha-icon> Neue Gruppe</button>' +
        '<button data-act="export"><ha-icon icon="mdi:swap-vertical"></ha-icon> Export/Import</button></div>' +
        '<div class="status' + (this._msg ? ' err' : '') + '">' + esc(this._msg || ('Status: ' + (this._dirty ? 'speichere …' : SB.status()))) + '</div>';
      if (this._showExport) {
        html += '<textarea>' + esc(JSON.stringify(d, null, 2)) + '</textarea><button class="primary" data-act="import">Import übernehmen</button>';
      }
      // Startseite
      var home = SB.home(d);
      used[home] = 1;
      var hp = byId[home];
      html += '<div class="group"><div class="ghead"><div class="gmain"><ha-icon icon="mdi:home-variant"></ha-icon><b style="flex:1;padding:4px">Startseite – immer ganz oben</b></div><div class="ctrl">' +
        '<select data-f="home" title="Welches Dashboard ganz oben steht">' + panels.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === home ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        }).join('') + '</select></div></div>';
      if (hp) {
        var hit = d.items[home] || {};
        var hwhy = res.reasons[home];
        html += '<div class="row' + (hwhy ? ' off' : '') + '"><div class="rmain"><ha-icon class="pi" icon="' + esc(hp.icon) + '"></ha-icon>' +
          '<div class="name" data-act="nav" data-id="' + esc(home) + '"><b>' + esc(hp.name) + '</b>' + (hwhy ? '<span class="why">' + esc(hwhy) + '</span>' : '') + '</div></div><div class="ctrl">' +
          this._ctrlCondHide(home, hit) + '</div></div>';
        if (self._open[home]) html += self._condHtml(hit.cond, home, false);
      }
      html += '</div>';
      // Gruppen
      d.groups.forEach(function (g, gi) {
        var members = (g.panels || []).filter(function (id) { return byId[id] && !used[id]; });
        members.forEach(function (id) { used[id] = 1; });
        var coll = SB.isCollapsed(g);
        html += '<div class="group"><div class="ghead"><div class="gmain">' +
          '<button class="icon" title="' + (coll ? 'auf diesem Gerät aufklappen' : 'auf diesem Gerät zuklappen') + '" data-act="gtoggle" data-id="' + esc(g.id) + '"><ha-icon icon="' + (coll ? 'mdi:chevron-right' : 'mdi:chevron-down') + '"></ha-icon></button>' +
          '<ha-icon icon="' + esc(g.icon || 'mdi:folder') + '"></ha-icon>' +
          '<input class="gname" data-f="gname" data-id="' + esc(g.id) + '" value="' + esc(g.name) + '">' +
          '<span class="gstate ' + (coll ? 'zu' : 'auf') + '" data-act="gtoggle" data-id="' + esc(g.id) + '">' + (coll ? 'zugeklappt' : 'aufgeklappt') + '</span>' +
          '<span class="gcount">' + members.length + '</span></div><div class="ctrl">' +
          '<select data-f="gdefault" data-id="' + esc(g.id) + '" title="So startet die Gruppe auf jedem Gerät, bis dort umgeschaltet wird">' +
          '<option value="auf"' + (g.startOpen ? ' selected' : '') + '>Standard: aufgeklappt</option>' +
          '<option value="zu"' + (!g.startOpen ? ' selected' : '') + '>Standard: zugeklappt</option></select>' +
          '<input class="txt" style="width:130px" title="Icon (mdi:…)" placeholder="mdi:folder" data-f="gicon" data-id="' + esc(g.id) + '" value="' + esc(g.icon || '') + '">' +
          '<button class="icon" title="Gruppe nach oben" data-act="gup" data-id="' + esc(g.id) + '"' + (gi === 0 ? ' disabled' : '') + '><ha-icon icon="mdi:arrow-up"></ha-icon></button>' +
          '<button class="icon" title="Gruppe nach unten" data-act="gdown" data-id="' + esc(g.id) + '"' + (gi === d.groups.length - 1 ? ' disabled' : '') + '><ha-icon icon="mdi:arrow-down"></ha-icon></button>' +
          '<button class="icon" title="Gruppen-Bedingung" data-act="gcond" data-id="' + esc(g.id) + '"><ha-icon icon="' + (g.cond ? 'mdi:filter-check' : 'mdi:filter-outline') + '"></ha-icon></button>' +
          '<button class="icon" title="' + (g.hidden ? 'Gruppe einblenden' : 'ganze Gruppe ausblenden') + '" data-act="ghide" data-id="' + esc(g.id) + '"><ha-icon icon="' + (g.hidden ? 'mdi:eye-off' : 'mdi:eye') + '"></ha-icon></button>' +
          '<button class="icon" title="Gruppe löschen" data-act="gdel" data-id="' + esc(g.id) + '"><ha-icon icon="mdi:delete-outline"></ha-icon></button>' +
          '</div></div>';
        if (self._open['g:' + g.id]) html += self._condHtml(g.cond, g.id, true);
        if (!members.length) html += '<div class="empty">Noch leer – bei einem Dashboard diese Gruppe auswählen.</div>';
        members.forEach(function (id, i) { html += self._rowHtml(byId[id], g, i, members.length, res); });
        html += '</div>';
      });
      // Ohne Gruppe
      var rest = panels.filter(function (p) { return !used[p.id]; });
      html += '<div class="group"><div class="ghead"><ha-icon icon="mdi:folder-outline"></ha-icon><b style="flex:1;padding:4px">Ohne Gruppe</b><span class="gcount">' + rest.length + '</span></div>';
      if (!rest.length) html += '<div class="empty">Alle Dashboards sind einer Gruppe zugeordnet.</div>';
      rest.forEach(function (p) { html += self._rowHtml(p, null, 0, 1, res); });
      html += '</div>';
      html += '<datalist id="sb-ents">' + Object.keys(this._hass.states).sort().map(function (e) { return '<option value="' + esc(e) + '">'; }).join('') + '</datalist>';
      html += '<div class="hint">Jede Gruppe erscheint in der Seitenleiste als Überschrift in GROSSBUCHSTABEN: „▼ NAME“ = aufgeklappt, „▶ NAME“ = zugeklappt. Ein Klick darauf klappt um – nur auf diesem Gerät. ' +
        '„Standard“ legt fest, wie eine Gruppe auf jedem Gerät startet, bis dort umgeschaltet wird; „Auf Standard“ verwirft das Auf/Zu dieses Geräts. ' +
        'Die Startseite steht immer ganz oben; danach folgen die Gruppen, dann „Ohne Gruppe“. ' +
        'Änderungen über „Seitenleiste bearbeiten“ in HA werden von Side-Bear überschrieben – bitte nur hier ändern. ' +
        'Schalter „inaktiv“: normale HA-Seitenleiste, deine Einstellungen bleiben gespeichert.</div></ha-card>';
      var focus = this.shadowRoot.activeElement;
      var fkey = focus && focus.dataset ? focus.dataset.f + '|' + focus.dataset.id : null;
      this.shadowRoot.innerHTML = html;
      if (fkey) {
        var el = this.shadowRoot.querySelector('[data-f="' + fkey.split('|')[0] + '"][data-id="' + fkey.split('|')[1] + '"]');
        if (el) el.focus();
      }
    }
  }
  if (!customElements.get('side-bear-settings')) customElements.define('side-bear-settings', SideBearSettings);

  /* ---------- Kacheln einer oder aller Gruppen (Gruppenseite und Lovelace-Karte) ---------- */
  class SideBearCard extends HTMLElement {
    setConfig(config) { this._config = config || {}; if (this._init) this._render(); }
    getCardSize() { return 4; }
    set hass(h) {
      this._hass = h;
      if (!this._init) {
        this._init = true;
        this._config = this._config || {};
        this.attachShadow({ mode: 'open' });
        var self = this;
        SB.onChange(function () { self._render(); });
        this.shadowRoot.addEventListener('click', function (e) {
          var b = e.target.closest('[data-id]');
          if (b) SB.navigate('/' + b.dataset.id);
        });
        SB.load().then(function () { self._render(); });
      }
    }
    _render() {
      var d = SB.getData();
      if (!this.shadowRoot) return;
      if (!d) { this.shadowRoot.innerHTML = '<ha-card style="padding:16px">Side-Bear ist nicht geladen.</ha-card>'; return; }
      var only = this._config.group;
      var showHidden = !!this._config.show_hidden;
      var byId = {};
      SB.panels().forEach(function (p) { byId[p.id] = p; });
      var res = SB.compute(d);
      var home = SB.home(d);
      var html = '<style>ha-card{padding:12px 16px}h3{margin:12px 0 6px;font-size:15px;font-weight:500;display:flex;gap:6px;align-items:center}' +
        '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}' +
        '.b{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:var(--secondary-background-color);cursor:pointer;font-size:14px}' +
        '.b:hover{filter:brightness(1.1)}.b.off{opacity:.45}</style><ha-card>';
      d.groups.forEach(function (g) {
        if (only && g.name !== only && g.id !== only) return;
        var ms = (g.panels || []).filter(function (id) { return id !== home && byId[id] && (showHidden ? res.reasons[id] !== 'ausgeblendet' : !res.reasons[id]); });
        if (!ms.length) return;
        html += '<h3><ha-icon icon="' + esc(g.icon || 'mdi:folder') + '"></ha-icon>' + esc(g.name) + '</h3><div class="grid">' +
          ms.map(function (id) { return '<div class="b' + (res.reasons[id] ? ' off' : '') + '" data-id="' + esc(id) + '"><ha-icon icon="' + esc(byId[id].icon) + '"></ha-icon>' + esc(byId[id].name) + '</div>'; }).join('') + '</div>';
      });
      this.shadowRoot.innerHTML = html + '</ha-card>';
    }
  }
  if (!customElements.get('side-bear-card')) customElements.define('side-bear-card', SideBearCard);

  /* ---------- Panel "Side-Bear" (Einstellungen) ---------- */
  class SideBearPanel extends HTMLElement {
    set hass(h) {
      this._hass = h;
      if (!this._parts) {
        this._parts = addToolbar(this, 'Side-Bear');
        this._inner = document.createElement('side-bear-settings');
        this._parts.content.appendChild(this._inner);
      }
      this._inner.hass = h;
      if (this._parts.menu) { this._parts.menu.hass = h; this._parts.menu.narrow = this._narrow; }
    }
    set narrow(n) { this._narrow = n; if (this._parts && this._parts.menu) this._parts.menu.narrow = n; }
    set panel(p) { this._panel = p; }
  }
  if (!customElements.get('side-bear-panel')) customElements.define('side-bear-panel', SideBearPanel);

  /* ---------- Panel einer Gruppen-Überschrift (Gruppenseite) ---------- */
  class SideBearGroupPanel extends HTMLElement {
    set panel(p) {
      this._panel = p;
      this._gid = p && p.config ? p.config.group_id : null;
      this._update();
    }
    set narrow(n) { this._narrow = n; if (this._parts && this._parts.menu) this._parts.menu.narrow = n; }
    set hass(h) {
      this._hass = h;
      if (!this._parts) {
        this._parts = addToolbar(this, '');
        this._card = document.createElement('side-bear-card');
        this._parts.content.appendChild(this._card);
        var self = this;
        SB.onChange(function () { self._update(); });
      }
      this._card.hass = h;
      if (this._parts.menu) { this._parts.menu.hass = h; this._parts.menu.narrow = this._narrow; }
      this._update();
    }
    _update() {
      if (!this._parts || !this._card) return;
      var d = SB.getData();
      var gid = this._gid;
      var g = d && d.groups.filter(function (x) { return x.id === gid; })[0];
      this._parts.title.textContent = g ? g.name : 'Side-Bear';
      this._card.setConfig({ group: gid, show_hidden: true });
    }
  }
  if (!customElements.get('side-bear-group')) customElements.define('side-bear-group', SideBearGroupPanel);

  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'side-bear-card', name: 'Side-Bear', description: 'Alle Dashboards nach Side-Bear-Gruppen als Kacheln' });
})();
