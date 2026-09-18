/* Resistive divider — output voltage, loading error, power, and E24 pairs. */
IB.register({
  id: "divider",
  name: "Voltage Divider",
  nav: "Divider",
  tag: "DC · resistors",
  blurb: "Two resistors and a tap. Solve for the output, see how much the load pulls it down, and get "
       + "the nearest standard-value pair that hits your target.",
  eq: "Vout = Vin · R2 / (R1 + R2)   ·   Rth = R1 ∥ R2",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { vin: 12, r1: 10000, r2: 3300, rl: 100000, loaded: true, target: 3.3 };

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" });
    var rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    /* ---- readouts ---- */
    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Output" }));
    var T = IB.tiles(top, [
      { id: "vout", k: "Vout, open", u: "V" },
      { id: "vl", k: "Vout, loaded", u: "V" },
      { id: "err", k: "Load error", u: "%" },
      { id: "i", k: "Current", u: "" },
      { id: "p", k: "Dissipation", u: "" },
      { id: "rth", k: "Thevenin R", u: "" }
    ], 6);

    var schem = svgEl("svg", { viewBox: "0 0 420 230", role: "img",
      "aria-label": "Divider schematic with Vin, R1, tap, R2 and the load" });
    top.appendChild(el("div", { class: "scroller" }, [schem]));
    top.appendChild(el("p", { class: "hint", id: "dvHint" }));

    /* ---- sweep chart ---- */
    var chartPanel = el("div", { class: "panel" });
    left.appendChild(chartPanel);
    chartPanel.appendChild(el("span", { class: "eyebrow", text: "Output against R2 · R1 held" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 290", role: "img",
      "aria-label": "Output voltage as R2 varies, with and without the load" });
    chartPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    chartPanel.appendChild(el("p", { class: "hint",
      text: "The loaded curve peels away from the ideal one as R2 approaches the load resistance — "
          + "which is why a divider feeding anything but a high-impedance input needs a buffer." }));

    /* ---- E24 finder ---- */
    var find = el("div", { class: "panel" });
    left.appendChild(find);
    find.appendChild(el("span", { class: "eyebrow", text: "Nearest standard pair (E24, 1 % tolerance)" }));
    var fwrap = el("div", { class: "scroller" });
    var ftab = el("table");
    fwrap.appendChild(ftab); find.appendChild(fwrap);
    find.appendChild(el("p", { class: "hint",
      text: "Ranked by output error, then by keeping the divider current sensible. Click a row to load it." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Inputs" }));
    var fVin = IB.field(rail, { id: "dv-vin", label: "Input voltage", unit: "V", value: P.vin,
      min: 0.1, max: 60, step: 0.1, onInput: function (v) { P.vin = v; draw(); } });
    var fR1 = IB.field(rail, { id: "dv-r1", label: "R1 (top)", unit: "Ω", value: P.r1,
      min: 10, max: 1e6, log: true, onInput: function (v) { P.r1 = v; draw(); } });
    var fR2 = IB.field(rail, { id: "dv-r2", label: "R2 (bottom)", unit: "Ω", value: P.r2,
      min: 10, max: 1e6, log: true, onInput: function (v) { P.r2 = v; draw(); } });
    IB.segmented(rail, { label: "Load on the tap", value: "yes",
      options: [{ label: "Loaded", value: "yes" }, { label: "Open circuit", value: "no" }],
      onInput: function (v) { P.loaded = v === "yes"; fRl.el.hidden = !P.loaded; draw(); } });
    var fRl = IB.field(rail, { id: "dv-rl", label: "Load resistance", unit: "Ω", value: P.rl,
      min: 100, max: 1e7, log: true, onInput: function (v) { P.rl = v; draw(); },
      hint: "An op-amp or ADC input is usually 1 MΩ and up; a transistor base can be a few kΩ." });
    rail.appendChild(el("div", { class: "field" }, [el("div", { class: "frow" },
      [el("label", { text: "Target output" })])]));
    var fTarget = IB.field(rail, { id: "dv-tg", label: "Wanted at the tap", unit: "V", value: P.target,
      min: 0.05, max: 60, step: 0.05, onInput: function (v) { P.target = v; draw(); },
      hint: "Drives the standard-pair table below, not the schematic." });

    /* ---- E24 ---- */
    var E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
               3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
    var DECADES = [1e1, 1e2, 1e3, 1e4, 1e5];
    var VALUES = [];
    DECADES.forEach(function (d) { E24.forEach(function (e) { VALUES.push(+(e * d).toFixed(6)); }); });

    function bestPairs(vin, target, n) {
      var out = [], i, j;
      for (i = 0; i < VALUES.length; i++) {
        for (j = 0; j < VALUES.length; j++) {
          var r1 = VALUES[i], r2 = VALUES[j], sum = r1 + r2;
          if (sum < 1000 || sum > 2e6) continue;              // keep current and noise sane
          var v = vin * r2 / sum;
          var err = (v - target) / target;
          if (Math.abs(err) > 0.03) continue;
          out.push({ r1: r1, r2: r2, v: v, err: err, i: vin / sum });
        }
      }
      out.sort(function (a, b) {
        var d = Math.abs(a.err) - Math.abs(b.err);
        if (Math.abs(d) > 1e-6) return d;
        return Math.abs(Math.log(a.i / 1e-3)) - Math.abs(Math.log(b.i / 1e-3));
      });
      return out.slice(0, n);
    }

    /* ---- schematic ---- */
    function buildSchematic() {
      IB.clear(schem);
      var g = svgEl("g", {});
      schem.appendChild(g);
      var X = 150, TOP = 26, N1 = 70, N2 = 118, N3 = 162, BOT = 200;
      function line(x1, y1, x2, y2, c, w) {
        g.appendChild(svgEl("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: c || "var(--ink)",
          "stroke-width": w || 1.8, "stroke-linecap": "round" }));
      }
      function box(y0, y1, color, label, val) {
        g.appendChild(svgEl("rect", { x: X - 15, y: y0, width: 30, height: y1 - y0, rx: 2,
          fill: "none", stroke: color, "stroke-width": 2 }));
        g.appendChild(svgEl("text", { x: X + 26, y: (y0 + y1) / 2 - 2, "font-size": 13, fill: color,
          "font-family": "IBM Plex Mono, monospace" }, label));
        g.appendChild(svgEl("text", { x: X + 26, y: (y0 + y1) / 2 + 13, "font-size": 12,
          fill: "var(--ink-2)", "font-family": "IBM Plex Mono, monospace", id: "sv-" + label }, val));
      }
      line(X, TOP, X, N1);
      box(N1, N2, "var(--s1)", "R1", IB.eng(P.r1, 3) + "Ω");
      line(X, N2, X, N3);
      box(N3, BOT, "var(--s2)", "R2", IB.eng(P.r2, 3) + "Ω");
      line(X, BOT, X, 214);
      line(X - 16, 214, X + 16, 214);
      line(X - 10, 219, X + 10, 219);
      line(X - 4, 224, X + 4, 224);
      // supply
      line(X, TOP, X - 70, TOP);
      line(X - 70, TOP, X - 70, 60);
      g.appendChild(svgEl("text", { x: X - 78, y: 20, "text-anchor": "middle", "font-size": 13,
        fill: "var(--ink)", "font-family": "IBM Plex Mono, monospace" }, "Vin"));
      g.appendChild(svgEl("text", { x: X - 78, y: 44, "text-anchor": "middle", "font-size": 12,
        fill: "var(--ink-2)", "font-family": "IBM Plex Mono, monospace" }, IB.fx(P.vin, 2) + " V"));
      // tap
      g.appendChild(svgEl("circle", { cx: X, cy: (N2 + N3) / 2, r: 3.6, fill: "var(--ink)" }));
      line(X, (N2 + N3) / 2, X + 108, (N2 + N3) / 2);
      if (P.loaded) {
        g.appendChild(svgEl("rect", { x: X + 108 - 15, y: (N2 + N3) / 2 + 16, width: 30, height: 40, rx: 2,
          fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.6 }));
        line(X + 108, (N2 + N3) / 2, X + 108, (N2 + N3) / 2 + 16, "var(--ink-3)", 1.6);
        line(X + 108, (N2 + N3) / 2 + 56, X + 108, 214, "var(--ink-3)", 1.6);
        line(X + 108, 214, X, 214, "var(--ink-3)", 1.6);
        g.appendChild(svgEl("text", { x: X + 130, y: (N2 + N3) / 2 + 40, "font-size": 12,
          fill: "var(--ink-3)", "font-family": "IBM Plex Mono, monospace" }, IB.eng(P.rl, 3) + "Ω"));
      }
      g.appendChild(svgEl("circle", { cx: X + 108, cy: (N2 + N3) / 2, r: 3.2, fill: "var(--ink-3)" }));
      g.appendChild(svgEl("text", { x: X + 118, y: (N2 + N3) / 2 - 8, "font-size": 13, fill: "var(--ink)",
        "font-family": "IBM Plex Mono, monospace" }, "Vout"));
    }

    /* ---- compute + render ---- */
    function draw() {
      var vout = P.vin * P.r2 / (P.r1 + P.r2);
      var r2eff = P.loaded ? (P.r2 * P.rl) / (P.r2 + P.rl) : P.r2;
      var vl = P.vin * r2eff / (P.r1 + r2eff);
      var i = P.vin / (P.r1 + r2eff);
      var p1 = i * i * P.r1, p2 = (vl * vl) / P.r2;
      var rth = (P.r1 * P.r2) / (P.r1 + P.r2);
      var err = vout > 0 ? (vl - vout) / vout * 100 : 0;

      T.vout.set(IB.sigfig(vout, 4));
      T.vl.set(IB.sigfig(vl, 4), P.loaded && Math.abs(err) > 5 ? "warnv" : "");
      T.err.set(IB.fx(err, 2), Math.abs(err) > 5 ? "warnv" : (Math.abs(err) > 0.5 ? "" : "goodv"));
      T.i.set(IB.engU(i, "A", 3));
      T.p.set(IB.engU(p1 + p2, "W", 3));
      T.rth.set(IB.eng(rth, 3) + "Ω");

      document.getElementById("dvHint").textContent =
        "R1 dissipates " + IB.engU(p1, "W", 2) + ", R2 " + IB.engU(p2, "W", 2) +
        ". The tap behaves like a " + IB.sigfig(vl, 3) + " V source behind " + IB.eng(rth, 3) +
        "Ω, so anything drawing more than about " + IB.engU(vl / (rth * 20), "A", 2) +
        " will visibly pull it down.";

      buildSchematic();

      // sweep R2 across three decades around the current value
      var lo = Math.max(10, P.r2 / 50), hi = Math.min(1e7, P.r2 * 50), k;
      var ideal = [], load = [];
      for (k = 0; k <= 160; k++) {
        var r = lo * Math.pow(hi / lo, k / 160);
        ideal.push([r, P.vin * r / (P.r1 + r)]);
        var re = P.loaded ? (r * P.rl) / (r + P.rl) : r;
        load.push([r, P.vin * re / (P.r1 + re)]);
      }
      IB.chart(cv, {
        w: 660, h: 290, pad: [26, 20, 46, 54],
        x: { min: lo, max: hi, log: true, label: "R2  (Ω)", fmt: function (v) { return IB.eng(v, 2) + "Ω"; } },
        y: { min: 0, max: P.vin, label: "Vout  (V)" },
        series: [
          { pts: ideal, color: "var(--s1)", width: 2.1 },
          P.loaded ? { pts: load, color: "var(--s2)", width: 2.1, dash: "6 4" } : null
        ].filter(Boolean),
        hlines: [{ y: P.target, color: "var(--ink-3)", dash: "2 4", label: "target " + IB.fx(P.target, 2) + " V" }],
        dots: [{ x: P.r2, y: P.loaded ? vl : vout, color: "var(--ink)" }],
        legend: P.loaded
          ? [{ color: "var(--s1)", label: "ideal" }, { color: "var(--s2)", label: "with load", dash: "6 4" }]
          : [{ color: "var(--s1)", label: "ideal (no load)" }]
      });

      // standard-value table
      IB.clear(ftab);
      var hd = el("tr", {}, [el("th", { text: "R1" }), el("th", { text: "R2" }),
        el("th", { text: "Vout" }), el("th", { text: "Error" }), el("th", { text: "Divider current" })]);
      ftab.appendChild(el("thead", {}, [hd]));
      var tb = el("tbody", {});
      var rows = bestPairs(P.vin, P.target, 6);
      if (!rows.length) {
        tb.appendChild(el("tr", {}, [el("td", { colspan: 5,
          text: "No E24 pair lands within 3 % of that target from this input voltage." })]));
      }
      rows.forEach(function (r) {
        var tr = el("tr", { class: (Math.abs(r.r1 - P.r1) < 1e-6 && Math.abs(r.r2 - P.r2) < 1e-6) ? "on" : "" }, [
          el("td", { text: IB.eng(r.r1, 3) + "Ω" }),
          el("td", { text: IB.eng(r.r2, 3) + "Ω" }),
          el("td", { text: IB.sigfig(r.v, 4) + " V" }),
          el("td", { text: (r.err >= 0 ? "+" : "") + IB.fx(r.err * 100, 2) + " %" }),
          el("td", { text: IB.engU(r.i, "A", 2) })
        ]);
        tr.style.cursor = "pointer";
        tr.addEventListener("click", function () {
          P.r1 = r.r1; P.r2 = r.r2;
          fR1.set(r.r1, true); fR2.set(r.r2, true);
          draw();
        });
        tb.appendChild(tr);
      });
      ftab.appendChild(tb);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "Unloaded output is <code>Vin · R2/(R1+R2)</code>. A load <code>RL</code> on the tap sits in "
        + "parallel with R2, so the real output is <code>Vin · (R2∥RL)/(R1 + R2∥RL)</code>. "
        + "The source impedance seen by that load is <code>R1∥R2</code> — keep it below about a "
        + "twentieth of the load resistance and the error stays under 5 %. Power in each leg is "
        + "<code>I²R</code>; a divider is always burning current, which is why high-value pairs are "
        + "preferred on battery gear and low-value pairs where noise or leakage matters. Standard values "
        + "are the E24 series (5 % spacing, available in 1 % parts) across the 10 Ω – 910 kΩ "
        + "decades. Tolerance stacking is not modelled: two 1 % parts can shift the output by roughly 1 %." })
    ]));

    fRl.el.hidden = !P.loaded;
    fVin.set(P.vin, true); fTarget.set(P.target, true);
    draw();
  }
});
