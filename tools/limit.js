/* Series current-limiting resistor — LEDs and anything else that needs a ballast. */
IB.register({
  id: "limit",
  name: "Current-Limiting Resistor",
  nav: "Limiting R",
  group: "Circuits",
  tag: "Series ballast · LEDs",
  blurb: "Size the series resistor, pick the nearest standard value, and see how badly the current "
       + "moves when the supply or the forward voltage drifts.",
  eq: "R = (Vs − n·Vf) / I   ·   P = I²R",

  mount: function (root) {
    var el = IB.el, svgEl = IB.svg;
    var P = { vs: 5, vf: 2.0, n: 1, target: 0.020, R: 150 };
    var E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
               3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
    var VALUES = [];
    [1e0, 1e1, 1e2, 1e3, 1e4].forEach(function (d) {
      E24.forEach(function (e) { VALUES.push(+(e * d).toFixed(4)); });
    });

    var cols = el("div", { class: "cols" });
    root.appendChild(cols);
    var left = el("div", { class: "stack" }), rail = el("aside", { class: "panel" });
    cols.appendChild(left); cols.appendChild(rail);

    var top = el("div", { class: "panel" });
    left.appendChild(top);
    top.appendChild(el("span", { class: "eyebrow", text: "Result" }));
    var T = IB.tiles(top, [
      { id: "rideal", k: "Ideal R", u: "" },
      { id: "rpick", k: "Nearest E24", u: "" },
      { id: "iact", k: "Actual current", u: "" },
      { id: "pr", k: "Resistor power", u: "" },
      { id: "rate", k: "Use a rating of", u: "" },
      { id: "eff", k: "Power to the load", u: "%" }
    ], 6);
    var schem = svgEl("svg", { viewBox: "0 0 460 150", role: "img",
      "aria-label": "Supply, series resistor and load in one loop" });
    top.appendChild(el("div", { class: "scroller" }, [schem]));
    top.appendChild(el("div", { class: "legend", id: "limChips" }));
    top.appendChild(el("p", { class: "hint", id: "limHint" }));

    var sensPanel = el("div", { class: "panel" });
    left.appendChild(sensPanel);
    sensPanel.appendChild(el("span", { class: "eyebrow",
      text: "Sensitivity · what happens when the parts are not nominal" }));
    var cv = svgEl("svg", { viewBox: "0 0 660 300", role: "img",
      "aria-label": "Current against forward voltage for the chosen resistor" });
    sensPanel.appendChild(el("div", { class: "scroller" }, [cv]));
    sensPanel.appendChild(el("p", { class: "hint", id: "sensHint" }));

    var tabPanel = el("div", { class: "panel" });
    left.appendChild(tabPanel);
    tabPanel.appendChild(el("span", { class: "eyebrow", text: "Standard values either side" }));
    var tw = el("div", { class: "scroller" }), tab = el("table");
    tw.appendChild(tab); tabPanel.appendChild(tw);
    tabPanel.appendChild(el("p", { class: "hint",
      text: "Click a row to use that resistor. Going one step up is almost always the safer miss." }));

    /* ---- controls ---- */
    rail.appendChild(el("span", { class: "eyebrow", text: "Circuit" }));
    var fVs = IB.field(rail, { id: "li-vs", label: "Supply voltage", unit: "V", value: P.vs,
      min: 0.5, max: 60, step: 0.1, onInput: function (v) { P.vs = v; sizeR(); draw(); } });
    var fVf = IB.field(rail, { id: "li-vf", label: "Load forward drop", unit: "V", value: P.vf,
      min: 0, max: 40, step: 0.05, onInput: function (v) { P.vf = v; sizeR(); draw(); },
      hint: "Red LEDs sit near 1.9 V, green and blue 2.9–3.4 V, white about 3.2 V. "
          + "Set 0 for a plain resistive or inrush-limiting job." });
    var fN = IB.field(rail, { id: "li-n", label: "Devices in series", unit: "", value: P.n,
      min: 1, max: 12, step: 1, onInput: function (v) { P.n = Math.round(v); sizeR(); draw(); } });
    var fI = IB.field(rail, { id: "li-i", label: "Target current", unit: "mA", value: P.target * 1000,
      min: 0.1, max: 2000, log: true, onInput: function (v) { P.target = v / 1000; sizeR(); draw(); } });
    var fR = IB.field(rail, { id: "li-r", label: "Resistor fitted", unit: "Ω", value: P.R,
      min: 0.1, max: 1e5, log: true, onInput: function (v) { P.R = v; draw(); },
      hint: "Sizing the target above sets this to the nearest standard value; override it here." });
    rail.appendChild(el("div", { class: "field" }, [
      el("div", { class: "frow" }, [el("label", { text: "Common jobs" })]),
      el("div", { class: "btnrow" }, [
        preset("5 V indicator LED", 5, 2.0, 1, 10),
        preset("3.3 V logic LED", 3.3, 2.0, 1, 5),
        preset("12 V strip, 3 white", 12, 3.2, 3, 20),
        preset("24 V pilot lamp", 24, 2.1, 1, 15)
      ])
    ]));
    function preset(label, vs, vf, n, mA) {
      var b = el("button", { type: "button", text: label });
      b.addEventListener("click", function () {
        P.vs = vs; P.vf = vf; P.n = n; P.target = mA / 1000;
        fVs.set(vs, true); fVf.set(vf, true); fN.set(n, true); fI.set(mA, true);
        sizeR(); draw();
      });
      return b;
    }

    function nearest(r, up) {
      var best = null, i;
      for (i = 0; i < VALUES.length; i++) {
        if (up && VALUES[i] < r) continue;
        if (best === null || Math.abs(VALUES[i] - r) < Math.abs(best - r)) best = VALUES[i];
      }
      return best === null ? VALUES[VALUES.length - 1] : best;
    }
    function sizeR() {
      var head = P.vs - P.n * P.vf;
      if (head <= 0 || P.target <= 0) return;
      P.R = nearest(head / P.target, true);      // round up: never over-drive the part
      fR.set(P.R, true);
    }
    function currentAt(vs, vf, R) { return Math.max(0, (vs - P.n * vf) / R); }

    function buildSchematic(I) {
      IB.clear(schem);
      var g = svgEl("g", {});
      schem.appendChild(g);
      function line(x1, y1, x2, y2, c, w) {
        g.appendChild(svgEl("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: c || "var(--ink)",
          "stroke-width": w || 1.8, "stroke-linecap": "round" }));
      }
      function txt(x, y, t, c, size, anchor) {
        g.appendChild(svgEl("text", { x: x, y: y, fill: c || "var(--ink-2)", "font-size": size || 12,
          "text-anchor": anchor || "start", "font-family": "IBM Plex Mono, monospace" }, t));
      }
      var Y = 56, BOT = 118;
      line(40, Y, 40, BOT);                                  // supply left rail
      line(40, Y, 120, Y); line(40, BOT, 400, BOT);
      // battery symbol
      line(30, 78, 50, 78, "var(--ink)", 2.4); line(34, 86, 46, 86, "var(--ink)", 1.6);
      line(30, 94, 50, 94, "var(--ink)", 2.4); line(34, 102, 46, 102, "var(--ink)", 1.6);
      txt(22, 50, IB.fx(P.vs, 2) + " V", "var(--ink)", 12.5, "middle");
      // resistor
      g.appendChild(svgEl("rect", { x: 120, y: Y - 11, width: 74, height: 22, rx: 2, fill: "none",
        stroke: "var(--s1)", "stroke-width": 2 }));
      line(194, Y, 250, Y);
      txt(157, Y - 19, IB.eng(P.R, 3) + "Ω", "var(--s1)", 12.5, "middle");
      txt(157, Y + 30, IB.engU(I * I * P.R, "W", 2), "var(--ink-3)", 11.5, "middle");
      // LEDs
      var x = 250, i;
      for (i = 0; i < Math.min(P.n, 4); i++) {
        g.appendChild(svgEl("path", { d: "M" + x + "," + (Y - 11) + " L" + x + "," + (Y + 11) +
          " L" + (x + 20) + "," + Y + " Z", fill: "var(--s2)", opacity: .75 }));
        line(x + 20, Y - 11, x + 20, Y + 11, "var(--s2)", 2);
        line(x + 24, Y - 12, x + 30, Y - 18, "var(--s2)", 1.2);
        line(x + 28, Y - 8, x + 34, Y - 14, "var(--s2)", 1.2);
        x += 34;
        if (i < Math.min(P.n, 4) - 1) line(x - 14, Y, x, Y, "var(--ink)", 1.8);
      }
      if (P.n > 4) txt(x + 6, Y + 4, "×" + P.n, "var(--ink-3)", 12);
      line(x, Y, 400, Y); line(400, Y, 400, BOT);
      txt(300, Y - 19, IB.fx(P.n * P.vf, 2) + " V", "var(--s2)", 12.5, "middle");
      // current arrow
      g.appendChild(svgEl("path", { d: "M212,88 L232,88", stroke: "var(--ink-3)", "stroke-width": 1.4 }));
      g.appendChild(svgEl("path", { d: "M232,88 L226,85 L226,91 Z", fill: "var(--ink-3)" }));
      txt(240, 92, IB.engU(I, "A", 3), "var(--ink-3)", 11.5);
    }

    function draw() {
      var head = P.vs - P.n * P.vf;
      var ideal = P.target > 0 ? head / P.target : Infinity;
      var I = currentAt(P.vs, P.vf, P.R);
      var pr = I * I * P.R, pload = I * P.n * P.vf, ptot = I * P.vs;
      var rating = [0.0625, 0.1, 0.125, 0.25, 0.5, 1, 2, 3, 5].filter(function (r) { return r >= pr * 2; })[0] || 10;

      T.rideal.set(head > 0 ? IB.eng(ideal, 3) + "Ω" : "—", head > 0 ? "" : "hot");
      T.rpick.set(IB.eng(P.R, 3) + "Ω");
      T.iact.set(IB.engU(I, "A", 3), I > P.target * 1.05 ? "warnv" : "");
      T.pr.set(IB.engU(pr, "W", 3));
      T.rate.set(rating < 1 ? IB.fx(rating * 1000) + " mW" : IB.fx(rating, 2) + " W");
      T.eff.set(ptot > 0 ? IB.fx(pload / ptot * 100) : "0", (pload / ptot) < 0.4 ? "warnv" : "");

      var chips = document.getElementById("limChips");
      IB.clear(chips);
      if (head <= 0) {
        chips.appendChild(el("span", { class: "chip on crit",
          text: "supply too low — " + IB.fx(P.n * P.vf, 2) + " V of forward drop needs more than "
            + IB.fx(P.vs, 2) + " V" }));
      } else {
        var frac = head / P.vs;
        chips.appendChild(el("span", { class: "chip on " + (frac < 0.15 ? "crit" : frac < 0.3 ? "warn" : "good"),
          text: IB.fx(frac * 100) + " % of the supply across the resistor" }));
        chips.appendChild(el("span", { class: "chip on " + (I > P.target * 1.1 ? "warn" : "good"),
          text: (I > P.target ? "+" : "") + IB.fx((I / P.target - 1) * 100, 1) + " % vs target" }));
      }

      // sensitivity: current against forward voltage, +/- 0.4 V
      var lo = Math.max(0, P.vf - 0.4), hi = P.vf + 0.4, pts = [], k;
      for (k = 0; k <= 80; k++) {
        var vf = lo + (hi - lo) * k / 80;
        pts.push([vf, currentAt(P.vs, vf, P.R) * 1000]);
      }
      var iMax = Math.max(currentAt(P.vs, lo, P.R), P.target) * 1000 * 1.15;
      IB.chart(cv, {
        w: 660, h: 300, pad: [24, 24, 46, 58],
        x: { min: lo, max: hi, label: "forward voltage per device  (V)",
             fmt: function (v) { return IB.fx(v, 2); } },
        y: { min: 0, max: Math.max(iMax, 0.1), label: "current  (mA)",
             fmt: function (v) { return IB.sigfig(v, 3); } },
        series: [{ pts: pts, color: "var(--s2)", width: 2.2 }],
        hlines: [{ y: P.target * 1000, color: "var(--ink-3)", dash: "4 3",
          label: "target " + IB.fx(P.target * 1000, 1) + " mA" }],
        dots: [{ x: P.vf, y: I * 1000, color: "var(--ink)" }]
      });
      var iLo = currentAt(P.vs, P.vf + 0.2, P.R), iHi = currentAt(P.vs, P.vf - 0.2, P.R);
      document.getElementById("sensHint").textContent = head > 0
        ? "A ±0.2 V spread in forward voltage — ordinary part-to-part variation — swings the "
          + "current between " + IB.fx(iLo * 1000, 1) + " and " + IB.fx(iHi * 1000, 1) + " mA, a range of "
          + IB.fx((iHi - iLo) / I * 100) + " %. The less headroom you leave across the resistor, the worse "
          + "that gets, which is why a constant-current driver wins on low-headroom supplies."
        : "No headroom: with this many devices in series the supply cannot light them at all.";

      document.getElementById("limHint").textContent = head > 0
        ? "The resistor burns " + IB.engU(pr, "W", 2) + " while the load gets " + IB.engU(pload, "W", 2)
          + ". A series resistor is a heater with a current-setting side effect — fine for an "
          + "indicator, wasteful above a watt or so."
        : "Reduce the number of devices in series, or raise the supply.";

      buildSchematic(I);

      IB.clear(tab);
      tab.appendChild(el("thead", {}, [el("tr", {}, [
        el("th", { text: "Resistor" }), el("th", { text: "Current" }), el("th", { text: "Vs target" }),
        el("th", { text: "Resistor power" }), el("th", { text: "Rating needed" })
      ])]));
      var tb = el("tbody", {});
      var base = VALUES.indexOf(nearest(P.R, false)), i2;
      for (i2 = Math.max(0, base - 3); i2 <= Math.min(VALUES.length - 1, base + 3); i2++) {
        (function (r) {
          var ii = currentAt(P.vs, P.vf, r), pp = ii * ii * r;
          var rt = [0.0625, 0.1, 0.125, 0.25, 0.5, 1, 2, 3, 5].filter(function (x) { return x >= pp * 2; })[0] || 10;
          var tr = el("tr", { class: Math.abs(r - P.R) < 1e-9 ? "on" : "" }, [
            el("td", { text: IB.eng(r, 3) + "Ω" }),
            el("td", { text: IB.fx(ii * 1000, 2) + " mA" }),
            el("td", { text: (ii >= P.target ? "+" : "") + IB.fx((ii / P.target - 1) * 100, 1) + " %" }),
            el("td", { text: IB.engU(pp, "W", 2) }),
            el("td", { text: rt < 1 ? IB.fx(rt * 1000) + " mW" : IB.fx(rt, 2) + " W" })
          ]);
          tr.style.cursor = "pointer";
          tr.addEventListener("click", function () { P.R = r; fR.set(r, true); draw(); });
          tb.appendChild(tr);
        })(VALUES[i2]);
      }
      tab.appendChild(tb);
    }

    root.appendChild(el("div", { class: "panel", style: "margin-top:18px" }, [
      el("span", { class: "eyebrow", text: "Method" }),
      el("p", { class: "note", html:
        "Whatever the load drops, the resistor takes the rest: <code>R = (Vs − n·Vf)/I</code>, "
        + "dissipating <code>I²R</code>. Standard values are rounded <em>up</em> so the real current "
        + "lands at or below the target. Resistors are rated at 70 °C in still air with no derating "
        + "curve applied, so the suggested rating is twice the calculated dissipation. "
        + "<strong>Where this breaks down:</strong> an LED's forward voltage is a device property with wide "
        + "part-to-part spread and a −2 mV/°C tempco, so a low-headroom design drifts badly with "
        + "temperature; LEDs in parallel on one resistor do not share current and should not be done; and "
        + "for anything above a few hundred milliamps a switching or linear constant-current source is both "
        + "more efficient and more repeatable. The model is DC only — no PWM dimming, no inrush." })
    ]));

    sizeR(); draw();
  }
});
