/* ============================================================
   Shell, router, and the shared bits every tool uses:
   number formatting, form fields, and one SVG chart renderer.
   ============================================================ */
window.IB = (function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- dom helpers ---------------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    apply(n, attrs);
    add(n, kids);
    return n;
  }
  function svg(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    add(n, kids);
    return n;
  }
  function apply(n, attrs) {
    for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
  }
  function add(n, kids) {
    if (kids === null || kids === undefined) return;
    (Array.isArray(kids) ? kids : [kids]).forEach(function (k) {
      if (k === null || k === undefined) return;
      n.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    });
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  /* ---------------- numbers ---------------- */
  var PREFIX = [
    [1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""],
    [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]
  ];
  // 4700 -> "4.70 k" ; 1.2e-5 -> "12.0 µ"
  function eng(x, sig) {
    sig = sig || 3;
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    var a = Math.abs(x), i;
    for (i = 0; i < PREFIX.length; i++) if (a >= PREFIX[i][0] * 0.999999) break;
    if (i === PREFIX.length) i = PREFIX.length - 1;
    var m = x / PREFIX[i][0];
    var d = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(m))));
    return m.toFixed(Math.min(d, 4)) + (PREFIX[i][1] ? " " + PREFIX[i][1] : "");
  }
  function engU(x, unit, sig) { return eng(x, sig) + (unit ? (eng(x, sig).indexOf(" ") > 0 ? "" : " ") + unit : ""); }
  function fx(x, d) { return isFinite(x) ? x.toFixed(d === undefined ? 0 : d) : "—"; }
  function sigfig(x, n) {
    if (!isFinite(x) || x === 0) return isFinite(x) ? "0" : "—";
    var d = Math.max(0, (n || 3) - 1 - Math.floor(Math.log10(Math.abs(x))));
    return x.toFixed(Math.min(d, 6));
  }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

  /* ---------------- per-viewer store (best effort) ---------------- */
  var mem = {};
  var store = {
    get: function (k, d) {
      if (k in mem) return mem[k];
      try {
        var v = window.localStorage.getItem("ib:" + k);
        if (v !== null) { mem[k] = JSON.parse(v); return mem[k]; }
      } catch (e) { /* private mode, blocked storage */ }
      return d;
    },
    set: function (k, v) {
      mem[k] = v;
      try { window.localStorage.setItem("ib:" + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
      return v;
    }
  };

  /* ---------------- form fields ---------------- */
  // A number input plus an optional (log) slider, kept in sync.
  function field(host, o) {
    var id = o.id;
    var wrapEl = el("div", { class: "field" });
    var inp = el("input", {
      type: "number", id: id, value: trimnum(o.value), step: o.step || "any",
      min: o.min !== undefined ? o.min : null, max: o.max !== undefined ? o.max : null,
      inputmode: "decimal"
    });
    var row = el("div", { class: "frow" }, [
      el("label", { for: id, text: o.label }),
      el("span", { class: "inbox" }, [inp, el("span", { class: "unit", text: o.unit || "" })])
    ]);
    wrapEl.appendChild(row);

    var rng = null;
    if (o.min !== undefined && o.max !== undefined && o.slider !== false) {
      rng = el("input", { type: "range", min: 0, max: 1000, step: 1, id: id + "-r",
        "aria-label": o.label + " slider" });
      rng.value = toSlider(o.value);
      wrapEl.appendChild(rng);
    }
    var sub = null;
    if (o.hint) { sub = el("p", { class: "sub", text: o.hint }); wrapEl.appendChild(sub); }
    host.appendChild(wrapEl);

    function toSlider(v) {
      v = clamp(v, o.min, o.max);
      var t = o.log ? (Math.log(v / o.min) / Math.log(o.max / o.min)) : (v - o.min) / (o.max - o.min);
      return Math.round(t * 1000);
    }
    function fromSlider(s) {
      var t = s / 1000;
      var v = o.log ? o.min * Math.pow(o.max / o.min, t) : o.min + t * (o.max - o.min);
      return o.snap ? o.snap(v) : round3(v);
    }
    function round3(v) {
      if (v === 0) return 0;
      var mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
      return Math.round(v / mag) * mag;
    }
    function trimnum(v) { return Math.abs(v) >= 1e-4 ? +(+v).toPrecision(6) : v; }

    var api = {
      el: wrapEl,
      get: function () { var v = parseFloat(inp.value); return isFinite(v) ? v : o.value; },
      set: function (v, silent) {
        v = o.min !== undefined ? clamp(v, o.min, o.max) : v;
        inp.value = trimnum(v);
        if (rng) rng.value = toSlider(v);
        if (!silent && o.onInput) o.onInput(v);
      },
      hint: function (t) { if (!sub) { sub = el("p", { class: "sub" }); wrapEl.appendChild(sub); } sub.textContent = t; }
    };
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      if (!isFinite(v)) return;
      if (o.min !== undefined) v = clamp(v, o.min, o.max);
      if (rng) rng.value = toSlider(v);
      if (o.onInput) o.onInput(v);
    });
    inp.addEventListener("blur", function () { api.set(api.get(), true); });
    if (rng) rng.addEventListener("input", function () {
      var v = fromSlider(+rng.value);
      inp.value = trimnum(v);
      if (o.onInput) o.onInput(v);
    });
    return api;
  }

  function select(host, o) {
    var sel = el("select", { id: o.id });
    o.options.forEach(function (op) {
      sel.appendChild(el("option", { value: op.value, text: op.label, selected: op.value === o.value ? "selected" : null }));
    });
    var wrapEl = el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { for: o.id, text: o.label }), sel])
    ]);
    if (o.hint) wrapEl.appendChild(el("p", { class: "sub", text: o.hint }));
    host.appendChild(wrapEl);
    sel.addEventListener("change", function () { if (o.onInput) o.onInput(sel.value); });
    return { el: wrapEl, get: function () { return sel.value; },
      set: function (v) { sel.value = v; if (o.onInput) o.onInput(v); } };
  }

  function segmented(host, o) {
    var wrapEl = el("div", { class: "field" });
    wrapEl.appendChild(el("div", { class: "frow" }, [el("label", { text: o.label })]));
    var seg = el("div", { class: "seg" });
    var btns = o.options.map(function (op) {
      var b = el("button", { type: "button", text: op.label, class: op.value === o.value ? "sel" : "" });
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        if (o.onInput) o.onInput(op.value);
      });
      seg.appendChild(b);
      return b;
    });
    wrapEl.appendChild(seg);
    if (o.hint) wrapEl.appendChild(el("p", { class: "sub", text: o.hint }));
    host.appendChild(wrapEl);
    return { el: wrapEl };
  }

  function tiles(host, defs, cols) {
    var g = el("div", { class: "tiles c" + (cols || defs.length) });
    var out = {};
    defs.forEach(function (d) {
      var v = el("span", { class: "v", text: "—" });
      var t = el("div", { class: "tile" }, [
        el("span", { class: "k eyebrow", text: d.k }),
        el("span", {}, [v, d.u ? el("span", { class: "u", text: d.u }) : null])
      ]);
      g.appendChild(t);
      out[d.id] = { tile: t, set: function (txt, state) {
        v.textContent = txt;
        t.className = "tile" + (state ? " " + state : "");
      } };
    });
    host.appendChild(g);
    return out;
  }

  /* ---------------- chart ---------------- */
  // One renderer for every plot on the site. Linear or log x, linear y.
  function chart(node, c) {
    clear(node);
    var W = c.w || 660, H = c.h || 300;
    var pt = c.pad && c.pad[0] !== undefined ? c.pad[0] : 24,
        pr = c.pad && c.pad[1] !== undefined ? c.pad[1] : 16,
        pb = c.pad && c.pad[2] !== undefined ? c.pad[2] : 44,
        pl = c.pad && c.pad[3] !== undefined ? c.pad[3] : 56;
    node.setAttribute("viewBox", "0 0 " + W + " " + H);
    var L = pl, R = W - pr, T = pt, B = H - pb;
    var x = c.x, y = c.y;
    var lx = !!x.log;
    function fwdX(v) { return lx ? Math.log10(Math.max(v, 1e-30)) : v; }
    var x0 = fwdX(x.min), x1 = fwdX(x.max), y0 = y.min, y1 = y.max;
    function X(v) { return L + (R - L) * ((fwdX(v) - x0) / (x1 - x0 || 1)); }
    function Y(v) { return B - (B - T) * ((v - y0) / (y1 - y0 || 1)); }
    var g = svg("g", {});
    node.appendChild(g);

    // grid + ticks
    var xt = x.ticks || autoTicks(x.min, x.max, lx), yt = y.ticks || autoTicks(y.min, y.max, false);
    xt.forEach(function (v) {
      if (v < x.min * 0.999 || v > x.max * 1.001) return;
      g.appendChild(svg("line", { x1: X(v), y1: T, x2: X(v), y2: B, stroke: "var(--rule-soft)", "stroke-width": 1 }));
      g.appendChild(svg("text", { x: X(v), y: B + 17, "text-anchor": "middle", "font-size": 11,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" },
        (x.fmt || defFmt)(v)));
    });
    yt.forEach(function (v) {
      if (v < y.min * 0.9999 || v > y.max * 1.0001) return;
      g.appendChild(svg("line", { x1: L, y1: Y(v), x2: R, y2: Y(v), stroke: "var(--rule-soft)", "stroke-width": 1 }));
      g.appendChild(svg("text", { x: L - 7, y: Y(v) + 4, "text-anchor": "end", "font-size": 11,
        fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" },
        (y.fmt || defFmt)(v)));
    });
    g.appendChild(svg("line", { x1: L, y1: B, x2: R, y2: B, stroke: "var(--rule)", "stroke-width": 1.2 }));
    g.appendChild(svg("line", { x1: L, y1: T, x2: L, y2: B, stroke: "var(--rule)", "stroke-width": 1.2 }));
    if (x.label) g.appendChild(svg("text", { x: (L + R) / 2, y: H - 6, "text-anchor": "middle",
      "font-size": 11.5, fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, x.label));
    if (y.label) g.appendChild(svg("text", { x: 13, y: (T + B) / 2, "text-anchor": "middle",
      "font-size": 11.5, fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace",
      transform: "rotate(-90 13 " + ((T + B) / 2) + ")" }, y.label));

    // reference lines
    (c.hlines || []).forEach(function (h) {
      g.appendChild(svg("line", { x1: L, y1: Y(h.y), x2: R, y2: Y(h.y), stroke: h.color || "var(--ink-3)",
        "stroke-width": h.width || 1, "stroke-dasharray": h.dash || "4 3" }));
      if (h.label) g.appendChild(svg("text", { x: R - 3, y: Y(h.y) - 5, "text-anchor": "end", "font-size": 10.5,
        fill: h.color || "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, h.label));
    });
    (c.vlines || []).forEach(function (v) {
      g.appendChild(svg("line", { x1: X(v.x), y1: T, x2: X(v.x), y2: B, stroke: v.color || "var(--ink-3)",
        "stroke-width": v.width || 1, "stroke-dasharray": v.dash || "4 3" }));
      if (v.label) g.appendChild(svg("text", { x: X(v.x) + 4, y: T + 12, "font-size": 10.5,
        fill: v.color || "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, v.label));
    });

    // series
    (c.series || []).forEach(function (s) {
      if (!s.pts || !s.pts.length) return;
      var d = "", started = false, i;
      for (i = 0; i < s.pts.length; i++) {
        var p = s.pts[i];
        if (!isFinite(p[0]) || !isFinite(p[1])) { started = false; continue; }
        var outside = p[1] < y.min || p[1] > y.max;
        var px = X(clamp(p[0], x.min, x.max)), py = Y(clamp(p[1], y.min, y.max));
        if (outside && !started) continue;             // stay out until it comes back
        d += (started ? " L" : "M") + px.toFixed(2) + "," + py.toFixed(2);
        started = !outside;                            // draw to the edge, then lift the pen
      }
      if (s.fill) {
        var base = Y(clamp(s.fillTo === undefined ? y.min : s.fillTo, y.min, y.max));
        var first = s.pts[0], last = s.pts[s.pts.length - 1];
        g.appendChild(svg("path", { d: d + " L" + X(clamp(last[0], x.min, x.max)) + "," + base +
          " L" + X(clamp(first[0], x.min, x.max)) + "," + base + " Z",
          fill: s.color, opacity: s.fillOpacity || 0.15, stroke: "none" }));
      }
      g.appendChild(svg("path", { d: d, fill: "none", stroke: s.color, "stroke-width": s.width || 2.1,
        "stroke-dasharray": s.dash || null, "stroke-linejoin": "round", "stroke-linecap": "round",
        opacity: s.opacity || 1 }));
    });

    // point markers
    (c.dots || []).forEach(function (p) {
      if (!isFinite(p.x) || !isFinite(p.y)) return;
      var px = X(clamp(p.x, x.min, x.max)), py = Y(clamp(p.y, y.min, y.max));
      g.appendChild(svg("circle", { cx: px, cy: py, r: 8.5, fill: "var(--panel)" }));
      g.appendChild(svg("circle", { cx: px, cy: py, r: 5.2, fill: p.color || "var(--ink)" }));
      if (p.label) g.appendChild(svg("text", { x: px + 11, y: py - 8, "font-size": 11.5,
        fill: "var(--ink-2)", "font-family": "IBM Plex Mono, monospace" }, p.label));
    });

    // legend across the top
    if (c.legend && c.legend.length) {
      var lx2 = L;
      c.legend.forEach(function (e) {
        g.appendChild(svg("line", { x1: lx2, y1: 11, x2: lx2 + 15, y2: 11, stroke: e.color,
          "stroke-width": 2.2, "stroke-dasharray": e.dash || null }));
        g.appendChild(svg("text", { x: lx2 + 21, y: 15, "font-size": 11.5, fill: "var(--ink-2)",
          "font-family": "Barlow, sans-serif" }, e.label));
        lx2 += 34 + e.label.length * 6.1;
      });
    }
    return { X: X, Y: Y, g: g };
  }
  function defFmt(v) {
    var a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-2 && a > 0)) return eng(v, 3);
    return String(Math.round(v * 1000) / 1000);
  }
  function autoTicks(min, max, log) {
    var out = [], i;
    if (log) {
      var a = Math.floor(Math.log10(min)), b = Math.ceil(Math.log10(max));
      for (i = a; i <= b; i++) out.push(Math.pow(10, i));
      return out;
    }
    var span = max - min;
    if (!(span > 0)) return [min];
    var step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    var n = span / step;
    if (n > 8) step *= (n > 16 ? 5 : 2);
    var start = Math.ceil(min / step) * step;
    for (i = start; i <= max + step * 1e-6; i += step) out.push(+(i.toFixed(10)));
    return out;
  }

  /* ---------------- tools registry + router ---------------- */
  var tools = [], byId = {}, current = null;

  function register(t) { tools.push(t); byId[t.id] = t; }

  function navLinks() {
    var nav = document.getElementById("nav");
    clear(nav);
    tools.forEach(function (t) {
      nav.appendChild(el("a", { href: "#/" + t.id, text: t.nav || t.name, "data-id": t.id }));
    });
    nav.appendChild(themeButton());
  }

  function themeButton() {
    var modes = ["auto", "light", "dark"];
    var b = el("button", { class: "themebtn", type: "button", title: "Theme" });
    function paint() {
      var m = store.get("theme", "auto");
      b.textContent = m === "auto" ? "Theme: auto" : (m === "light" ? "Theme: light" : "Theme: dark");
      if (m === "auto") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", m);
    }
    b.addEventListener("click", function () {
      var m = store.get("theme", "auto");
      store.set("theme", modes[(modes.indexOf(m) + 1) % 3]);
      paint();
      if (current && current.themed) current.themed();
    });
    paint();
    return b;
  }

  function route() {
    var id = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    var main = document.getElementById("main");
    if (current && current.unmount) { try { current.unmount(); } catch (e) { /* keep going */ } }
    current = null;
    clear(main);
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.classList.toggle("on", a.dataset.id === id);
    });
    var t = byId[id];
    if (!t) { hub(main); document.title = "Motor and Circuit Tools"; }
    else {
      var host = el("div", { class: "wrap t-" + t.id });
      main.appendChild(host);
      host.appendChild(el("div", { class: "crumbs" }, [
        el("a", { href: "#/", text: "All tools" }), el("span", { text: "/" }), el("span", { text: t.name })
      ]));
      var head = el("div", { class: "pagehead" }, [
        el("div", {}, [
          el("span", { class: "eyebrow", text: t.tag }),
          el("h1", { text: t.name }),
          el("p", { text: t.blurb })
        ])
      ]);
      host.appendChild(head);
      var body = el("div", {});
      host.appendChild(body);
      current = t;
      t.mount(body, head);
      document.title = t.name;
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- hub ---------------- */
  function hub(main) {
    var w = el("div", { class: "wrap" });
    main.appendChild(w);
    w.appendChild(el("p", { class: "lede", text:
      "Small, exact tools for the arithmetic between a schematic and a working build: time constants, "
      + "resonance, copper losses, pack sag, divider values, and two motor simulations you can watch "
      + "turn. Every page states its formulas and what it leaves out." }));
    w.appendChild(el("div", { class: "sechead" }, [
      el("h2", { text: "Tools" }),
      el("div", { class: "rule" }),
      el("span", { class: "count", text: tools.length })
    ]));

    var idx = el("div", { class: "index" });
    tools.forEach(function (t) {
      idx.appendChild(el("a", { class: "card", href: "#/" + t.id }, [
        el("div", { class: "top" }, [
          glyph(t.id),
          el("div", {}, [el("span", { class: "tag", text: t.tag }), el("h3", { text: t.name })])
        ]),
        el("p", { text: t.blurb }),
        el("div", { class: "go", text: (t.live ? "Run the simulation \u2192" : "Open \u2192") }),
        el("div", { class: "eq", text: t.eq })
      ]));
    });
    idx.appendChild(el("div", { class: "card wide" }, [
      el("div", { class: "top" }, [
        el("div", {}, [
          el("span", { class: "tag", text: "Conventions" }),
          el("h3", { text: "How to read these" })
        ])
      ]),
      el("p", { text: "Inputs accept engineering notation \u2014 1e-7 for 100 nF, 4.7e3 for 4k7. Sliders are "
        + "logarithmic where the quantity spans decades. Torque is in mN\u00b7m, angles in degrees, "
        + "everything else SI." }),
      el("div", { class: "eq", text: "each tool ends with its method and its omissions" })
    ]));
    w.appendChild(idx);
  }

  // Small schematic fragment per tool — drawn, not iconography.
  function glyph(id) {
    var s = svg("svg", { class: "glyph", viewBox: "0 0 58 40", "aria-hidden": "true" });
    var st = { fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.6, "stroke-linecap": "round",
      "stroke-linejoin": "round" };
    function p(d, color, w) {
      return svg("path", { d: d, fill: "none", stroke: color || st.stroke, "stroke-width": w || 1.6,
        "stroke-linecap": "round", "stroke-linejoin": "round" });
    }
    if (id === "motor") {
      s.appendChild(svg("circle", { cx: 29, cy: 20, r: 15, fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.4 }));
      s.appendChild(svg("circle", { cx: 29, cy: 20, r: 7.5, fill: "var(--s1)", opacity: .25, stroke: "none" }));
      s.appendChild(p("M29 20 L41 12", "var(--s1)", 2));
      [0, 60, 120, 180, 240, 300].forEach(function (a) {
        var r = a * Math.PI / 180;
        s.appendChild(p("M" + (29 + 10 * Math.cos(r)) + " " + (20 + 10 * Math.sin(r)) +
          " L" + (29 + 15 * Math.cos(r)) + " " + (20 + 15 * Math.sin(r)), "var(--ink-3)", 2.4));
      });
    } else if (id === "brushed") {
      s.appendChild(svg("circle", { cx: 29, cy: 20, r: 15, fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.4 }));
      s.appendChild(svg("path", { d: "M14 8 A15 15 0 0 0 14 32", fill: "none", stroke: "var(--north)", "stroke-width": 4, opacity: .8 }));
      s.appendChild(svg("path", { d: "M44 8 A15 15 0 0 1 44 32", fill: "none", stroke: "var(--south)", "stroke-width": 4, opacity: .8 }));
      s.appendChild(svg("rect", { x: 20, y: 14, width: 18, height: 12, rx: 2, fill: "none", stroke: "var(--s1)", "stroke-width": 2 }));
      s.appendChild(svg("rect", { x: 27, y: 2, width: 4, height: 5, fill: "var(--copper)" }));
      s.appendChild(svg("rect", { x: 27, y: 33, width: 4, height: 5, fill: "var(--copper)" }));
    } else if (id === "rc") {
      s.appendChild(p("M4 34 C18 34 20 6 54 6", "var(--s2)", 2));
      s.appendChild(p("M4 34 L54 34", "var(--rule)", 1.2));
      s.appendChild(p("M18 6 L18 34", "var(--rule)", 1.2));
    } else if (id === "lc") {
      s.appendChild(p("M4 33 C20 33 22 8 29 8 C36 8 38 33 54 33", "var(--s3)", 2));
      s.appendChild(p("M29 4 L29 36", "var(--rule)", 1.2));
    } else if (id === "wire") {
      s.appendChild(p("M3 12 L55 12", "var(--copper)", 3.4));
      s.appendChild(p("M3 20 L55 20", "var(--copper)", 2.2));
      s.appendChild(p("M3 27 L55 27", "var(--copper)", 1.3));
      s.appendChild(p("M3 33 L55 33", "var(--copper)", .8));
    } else if (id === "pack") {
      s.appendChild(svg("rect", { x: 4, y: 11, width: 40, height: 18, rx: 2, fill: "none",
        stroke: "var(--ink-3)", "stroke-width": 1.5 }));
      s.appendChild(svg("rect", { x: 44, y: 16, width: 5, height: 8, rx: 1, fill: "var(--ink-3)" }));
      s.appendChild(svg("rect", { x: 7, y: 14, width: 22, height: 12, fill: "var(--s3)", opacity: .55 }));
    } else if (id === "divider") {
      s.appendChild(p("M29 2 L29 8", "var(--ink-3)", 1.4));
      s.appendChild(p("M25 8 L33 8 L33 17 L25 17 Z", "var(--s1)", 1.6));
      s.appendChild(p("M29 17 L29 22", "var(--ink-3)", 1.4));
      s.appendChild(p("M25 22 L33 22 L33 31 L25 31 Z", "var(--s2)", 1.6));
      s.appendChild(p("M29 31 L29 36 M23 36 L35 36", "var(--ink-3)", 1.4));
      s.appendChild(p("M33 20 L46 20", "var(--ink-3)", 1.2));
      s.appendChild(svg("circle", { cx: 48, cy: 20, r: 2, fill: "var(--ink-3)" }));
    }
    return s;
  }

  /* ---------------- boot ---------------- */
  function start() {
    navLinks();
    window.addEventListener("hashchange", route);
    route();
  }

  return {
    el: el, svg: svg, clear: clear, apply: apply,
    eng: eng, engU: engU, fx: fx, sigfig: sigfig, clamp: clamp,
    field: field, select: select, segmented: segmented, tiles: tiles,
    chart: chart, store: store, register: register, start: start, reduce: reduce
  };
})();
